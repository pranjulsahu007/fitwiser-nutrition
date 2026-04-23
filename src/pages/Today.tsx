import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Check, ChevronLeft, ChevronUp, Plus, Info, AlertCircle, Calendar, Minus, X, LogOut, Droplet, Scale, Coffee, Utensils, UtensilsCrossed, GlassWater, PieChart, Hand, LayoutGrid, CircleDot, Disc, FolderClosed, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateMultiplier, parseQuantity, MEASURE_UNITS } from '../lib/units';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getUnitIcon = (type: string, isSelected: boolean = false) => {
   const props = { className: `w-[18px] h-[18px] ${isSelected ? 'text-white/90' : 'text-[#1ca06f]'}` };
   switch (type) {
      case 'cup': return <Coffee {...props} />;
      case 'bowl': return <CircleDot {...props} />;
      case 'plate': return <Disc {...props} />;
      case 'glass': return <GlassWater {...props} />;
      case 'handful': return <Hand {...props} />;
      case 'slice': return <PieChart {...props} />;
      case 'piece': return <LayoutGrid {...props} />;
      case 'teaspoon': return <Utensils {...props} />;
      case 'tablespoon': return <UtensilsCrossed {...props} />;
      case 'milliliters': return <Droplet {...props} />;
      case 'grams': 
      case 'ounces': return <Scale {...props} />;
      default: return <LayoutGrid {...props} />;
   }
};

export function Today({ session }: { session: Session }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [assignmentsByGroup, setAssignmentsByGroup] = useState<Record<string, any[]>>({});
  
  // Custom quantity adjusting modal state
  const [adjustingItem, setAdjustingItem] = useState<{
    assignment: any;
    quantity: number;
    unitLabel: string;
    type: string;
    isUpdating: boolean;
  } | null>(null);

  // Manual logging search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Maps mapping nutrition item ID -> meal_logs row object
  const [loggedRecords, setLoggedRecords] = useState<Record<number, any>>({});
  const [manualLogs, setManualLogs] = useState<any[]>([]);

  const currentDateStr = format(selectedDate, 'yyyy-MM-dd');
  const currentDayName = format(selectedDate, 'EEEE');

  // Generate days for the current week (starting on Monday)
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch meal assignments for the selected day of week
      const { data: assignments, error: assignmentError } = await supabase
        .from('meal_assignments')
        .select(`
          id,
          meal_id,
          category,
          description,
          nutrition_items (
            id,
            name,
            calories,
            proteins,
            carbs,
            fats,
            density,
            piecewise_multiplier
          )
        `)
        .eq('client_id', session.user.id)
        .eq('day', currentDayName);

      if (assignmentError) throw assignmentError;

      const grouped: Record<string, any[]> = {};
      if (assignments) {
        assignments.forEach((a) => {
          const cat = a.category || 'Other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(a);
        });
      }
      setAssignmentsByGroup(grouped);

      // 2. Fetch logged records specifically for this calendar day
      const { data: logs, error: logError } = await supabase
        .from('meal_logs')
        .select('id, meals, notes, total_calories, total_protein, total_carbs, total_fat, ai_food_name')
        .eq('user_id', session.user.id)
        .eq('log_date', currentDateStr);

      if (logError && logError.code !== 'PGRST116') {
        console.error("Log fetch error: ", logError);
      }

      const logMap: Record<number, any> = {};
      const mLogs: any[] = [];
      const usedLogIds = new Set<number>();

      if (logs) {
        const allAssignments = Object.values(grouped).flat();

        // Pass 1: Try to match explicit keys in notes
        logs.forEach(log => {
           if (log.notes && log.notes.includes('assignment-key:assignment:')) {
             const m = log.notes.match(/assignment-key:assignment:(\d+)/);
             if (m && m[1]) {
                logMap[parseInt(m[1])] = log;
                usedLogIds.add(log.id);
             }
           }
        });

        // Pass 2: Fallback map logic mapping by matching nutrition items
        allAssignments.forEach((assignment: any) => {
          if (!logMap[assignment.id]) {
            const matchingLog = logs.find(log => 
              !usedLogIds.has(log.id) && log.meals && Array.isArray(log.meals) && log.meals.includes(assignment.meal_id)
            );
            if (matchingLog) {
              logMap[assignment.id] = matchingLog;
              usedLogIds.add(matchingLog.id);
            }
          }
        });

        // Pass 3: Manual logs
        logs.forEach(log => {
          if (!usedLogIds.has(log.id)) {
            mLogs.push(log);
          }
        });
      }
      setLoggedRecords(logMap);
      setManualLogs(mLogs);

    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session.user.id, currentDateStr, currentDayName]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const fetchResults = async () => {
      setIsSearching(true);
      const { data } = await supabase
        .from('nutrition_items')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .limit(10);
        
      setSearchResults(data || []);
      setIsSearching(false);
    };
    
    const delayDebounceFn = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const toggleItemDone = async (assignment: any) => {
    const assignmentId = assignment.id;
    if (!assignmentId) return;

    const existingRecord = loggedRecords[assignmentId];

    if (existingRecord) {
      // Uncheck: Delete the log
      setLoggedRecords((prev) => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });

      try {
        await supabase.from('meal_logs').delete().eq('id', existingRecord.id);
      } catch (err) {
        console.error("Failed to delete log", err);
        fetchData(); // Rollback on failure
      }
    } else {
      // Check: Insert new log using default original baseline
      const nutrition = assignment.nutrition_items || {};
      const actualDesc = assignment.description || '1 piece';
      const m = calculateMultiplier(actualDesc, nutrition.density, nutrition.piecewise_multiplier);
      
      await saveLogEntry(assignment, actualDesc, nutrition, m);
    }
  };

  const saveLogEntry = async (assignment: any | null, descStr: string, nutrition: any, multiplier: number) => {
    const assignmentId = assignment?.id || null;
    const mealId = assignment?.meal_id || null;

    if (assignmentId) {
      setLoggedRecords((prev) => ({
        ...prev,
        [assignmentId]: { id: -1, __temp: true }
      }));
    }

    const payloadNotes = assignmentId ? `${descStr} [assignment-key:assignment:${assignmentId}:meal:${mealId}]` : descStr;

    try {
      const { data, error } = await supabase
        .from('meal_logs')
        .insert([{
          user_id: session.user.id,
          log_date: currentDateStr,
          meals: mealId ? [mealId] : [],
          total_calories: parseFloat(nutrition.calories || '0') * multiplier,
          total_protein: parseFloat(nutrition.proteins || '0') * multiplier,
          total_carbs: parseFloat(nutrition.carbs || '0') * multiplier,
          total_fat: parseFloat(nutrition.fats || '0') * multiplier,
          notes: payloadNotes,
          ai_food_name: nutrition.name,
          is_manual: true
        }])
        .select('id, meals, notes, total_calories, total_protein, total_carbs, total_fat, ai_food_name')
        .single();

      if (error) throw error;
      
      if (data) {
        if (assignmentId) {
          setLoggedRecords((prev) => ({
            ...prev,
            [assignmentId]: data
          }));
        } else {
          setManualLogs(prev => [...prev, data]);
        }
      }
    } catch (err) {
      console.error("Failed to insert log", err);
      fetchData(); // Rollback on failure
    }
  };

  const openAdjustMenu = (assignment: any) => {
    let defaultDesc = '1 piece';
    if (assignment.description) {
       defaultDesc = assignment.description;
    } else if (assignment.id && loggedRecords[assignment.id] && loggedRecords[assignment.id].notes) {
       defaultDesc = loggedRecords[assignment.id].notes;
    }
    
    if (defaultDesc.includes('[assignment-key:')) {
      defaultDesc = defaultDesc.split('[assignment-key:')[0].trim();
    }
    
    if (defaultDesc && defaultDesc.startsWith('Checklist log')) {
      const m = defaultDesc.match(/\((.*?)\)/);
      defaultDesc = m ? m[1] : (assignment.description || '1 piece');
    }

    const parsed = parseQuantity(defaultDesc);
    setAdjustingItem({
      assignment,
      quantity: parsed.quantity || 1,
      unitLabel: parsed.originalUnit || 'pcs',
      type: parsed.type || 'piece',
      isUpdating: false
    });
  };

  const handleCustomLog = async () => {
    if (!adjustingItem) return;
    setAdjustingItem(prev => prev ? { ...prev, isUpdating: true } : null);

    const { assignment, quantity, unitLabel } = adjustingItem;
    const assignmentId = assignment.id || null;
    const descStr = `${quantity} ${unitLabel}`;
    const nutrition = assignment.nutrition_items || {};
    const m = calculateMultiplier(descStr, nutrition.density, nutrition.piecewise_multiplier);

    if (assignmentId) {
      const existingRecord = loggedRecords[assignmentId];
      if (existingRecord && existingRecord.id !== -1) {
         await supabase.from('meal_logs').delete().eq('id', existingRecord.id);
      }
    }
    
    await saveLogEntry(assignment, descStr, nutrition, m);
    
    if (!assignmentId) {
       setIsSearchMode(false);
       setSearchQuery('');
    }
    setAdjustingItem(null);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-2">
        <h1 className="text-[20px] font-bold text-[#1e293b] tracking-tight">Nutrition</h1>
        <button 
          onClick={handleSignOut} 
          className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors" 
          title="Sign Out"
        >
           <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-2 px-1">
        {weekDays.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          return (
            <button
              key={date.toISOString()}
              onClick={() => setSelectedDate(date)}
              className={cn(
                "px-4 py-2.5 rounded-[14px] text-[15px] font-bold transition-all whitespace-nowrap",
                isSelected 
                  ? "bg-[#1ca06f] text-white shadow-md shadow-[#1ca06f]/20" 
                  : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]"
              )}
            >
              {format(date, 'EEE')}
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <h2 className="text-[17px] font-bold text-[#1e293b] tracking-tight">Assignments for {currentDayName}</h2>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 p-4 border border-red-100 rounded-xl flex gap-3 text-red-800 mb-6 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center p-10">
          <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(assignmentsByGroup).length === 0 && !errorMsg ? (
            <div className="bg-white p-6 rounded-[1.5rem] text-center border border-slate-100 shadow-sm">
              <p className="text-slate-500 text-sm font-medium">No meals assigned for {currentDayName}.</p>
            </div>
          ) : (
            Object.keys(assignmentsByGroup)
              .sort((a, b) => {
                const CATEGORY_ORDER = [
                  'Morning Ritual',
                  'Breakfast',
                  'Snack 1',
                  'Lunch',
                  'Snack 2',
                  'Preworkout',
                  'Dinner'
                ];
                const catA = a.toLowerCase();
                const catB = b.toLowerCase();
                const idxA = CATEGORY_ORDER.findIndex(c => c.toLowerCase() === catA);
                const idxB = CATEGORY_ORDER.findIndex(c => c.toLowerCase() === catB);
                
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
              })
              .map((category) => {
                const items = assignmentsByGroup[category];
              const totalCals = items.reduce((acc, item) => {
                const nut = item.nutrition_items || {};
                const m = calculateMultiplier(item.description, nut.density, nut.piecewise_multiplier);
                const c = parseFloat(nut.calories || "0") * m;
                return acc + (isNaN(c) ? 0 : c);
              }, 0);

              return (
                <div key={category} className="bg-white rounded-3xl p-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-[#f1f5f9]">
                  {/* Category Header */}
                  <div className="flex justify-between items-center mb-4 mt-1">
                    <h3 className="text-[16px] font-bold text-[#0f172a] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{category}</h3>
                    <div className="flex items-center gap-2">
                       {totalCals > 0 && (
                         <span className="bg-[#f1f5f9] text-[#64748b] text-[12px] font-bold px-2.5 py-1 rounded-[10px] shrink-0">
                           {Math.round(totalCals)} kcal
                         </span>
                       )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2.5">
                    {items.map((assignment) => {
                      const itemData = assignment.nutrition_items || {};
                      
                      const logContext = loggedRecords[assignment.id];
                      const isLogged = !!logContext;
                      
                      const mass = assignment.description ? assignment.description : '100 g';
                      const m = calculateMultiplier(assignment.description, itemData.density, itemData.piecewise_multiplier);
                      
                      const displayCals = Math.round((parseFloat(itemData.calories || '0') * m));
                      const displayProtein = Math.round((parseFloat(itemData.proteins || '0') * m));

                      return (
                         <div 
                           key={assignment.id}
                           onClick={() => toggleItemDone(assignment)}
                           className={cn(
                             "border border-[#f1f5f9] rounded-2xl p-3 flex justify-between items-center transition-all cursor-pointer relative overflow-hidden",
                             isLogged ? "bg-white border-[#f1f5f9]" : "bg-white hover:border-[#1ca06f]/40 hover:shadow-sm"
                           )}
                        >
                          <div className={cn("flex items-start gap-3 w-full transition-opacity", isLogged ? "opacity-60" : "opacity-100")}>
                            {/* Checkbox Element */}
                            <div className="pt-0.5">
                              <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center border-[1.5px] transition-colors",
                                isLogged 
                                  ? "bg-[#1ca06f] border-[#1ca06f]" 
                                  : "bg-white border-slate-300"
                              )}>
                                {isLogged && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                              </div>
                            </div>

                            {/* Food Text Information */}
                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={cn(
                                  "font-bold text-[14px] leading-snug", 
                                  isLogged ? "text-slate-500 line-through decoration-slate-300" : "text-[#0f172a]"
                                )}>
                                  {itemData.name || 'Unknown Item'}
                                </span>
                                <Info className="w-3 h-3 text-[#1ca06f]" />
                              </div>
                              <span className="text-[12px] font-medium text-[#64748b] block">
                                {displayCals} cal • {displayProtein}g Protein
                              </span>
                            </div>
                            
                            {/* Right Specifics Badge */}
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                openAdjustMenu(assignment);
                              }}
                              className="bg-[#e3f2ec] text-[#1aa369] px-3 py-1 rounded-[12px] text-[12px] font-bold whitespace-nowrap self-center tracking-tight hover:bg-[#c9ebd9] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm"
                            >
                               {mass}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* All Logged Meals Section at Bottom */}
          <div className="mt-8 pt-6">
            <h2 className="text-[13px] font-bold text-slate-400 tracking-widest uppercase mb-3 px-1">Log A Meal</h2>
            <div 
              onClick={() => setIsSearchMode(true)}
              className="bg-[#f0fdf4] hover:bg-[#dcfce7] active:scale-[0.98] transition-all cursor-pointer border border-[#bbf7d0] rounded-2xl p-4 flex gap-4 items-center shadow-sm mb-6">
              <div className="w-12 h-12 bg-[#fef08a] rounded-xl flex items-center justify-center shrink-0">
                <FolderClosed className="w-6 h-6 text-yellow-600" fill="currentColor" />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-slate-800">Manual Log</h3>
                <p className="text-[13px] text-slate-500 font-medium tracking-tight">Search from our food database</p>
              </div>
            </div>

            {(Object.keys(loggedRecords).length > 0 || manualLogs.length > 0) && (
              <div className="pt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <Calendar className="w-4 h-4 text-[#1ca06f]" />
                  <h2 className="text-[16px] font-bold text-[#1e293b] tracking-tight">Logged on {currentDayName}</h2>
                </div>
                
                <div className="space-y-3">
                  {/* render assignment logs */}
                  {Object.entries(loggedRecords).map(([assignmentIdStr, logRow], idx) => {
                    if (logRow.__temp) return null;
                    const assignmentId = parseInt(assignmentIdStr);
                    const assignment = Object.values(assignmentsByGroup).flat().find(a => a.id === assignmentId);
                    const foodName = logRow.ai_food_name || assignment?.nutrition_items?.name || `Logged Item #${logRow.id}`;
                    
                    let displayQuantity = logRow.notes || '';
                    if (displayQuantity.includes('[assignment-key:')) {
                      displayQuantity = displayQuantity.split('[assignment-key:')[0].trim();
                    }
                    if (displayQuantity && displayQuantity.startsWith('Checklist log')) {
                      const m = displayQuantity.match(/\((.*?)\)/);
                      displayQuantity = m ? m[1] : (assignment?.description || '');
                    } else if (!displayQuantity && assignment?.description) {
                      displayQuantity = assignment.description;
                    }
                    
                    return (
                      <div key={`auto-${logRow.id || idx}`} className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 flex justify-between items-center w-full">
                         <div className="w-full">
                           <div className="font-bold text-[#0f172a] text-[14px] mb-0.5 flex justify-between w-full">
                             <span>{foodName}</span>
                             {displayQuantity && <span className="text-slate-500 font-bold ml-2 shrink-0">{displayQuantity}</span>}
                           </div>
                           <div className="text-[12px] text-[#64748b] flex gap-2">
                             <span className="font-medium text-[#1ca06f]">{Math.round(logRow.total_calories || 0)} kcal</span>
                             <span>• {Math.round(logRow.total_protein || 0)}g pro</span>
                             <span>• {Math.round(logRow.total_carbs || 0)}g crbs</span>
                             <span>• {Math.round(logRow.total_fat || 0)}g fat</span>
                           </div>
                         </div>
                      </div>
                    );
                  })}
                  {/* render manual logs */}
                  {manualLogs.map((logRow, idx) => {
                    let displayQuantity = logRow.notes || '';
                    if (displayQuantity.includes('[assignment-key:')) {
                      displayQuantity = displayQuantity.split('[assignment-key:')[0].trim();
                    }
                    if (displayQuantity && displayQuantity.startsWith('Checklist log')) {
                      const m = displayQuantity.match(/\((.*?)\)/);
                      displayQuantity = m ? m[1] : '';
                    }

                    return (
                      <div key={`manual-${logRow.id || idx}`} className="bg-[#f8fafc] border border-slate-200 rounded-xl p-3 flex justify-between items-center relative overflow-hidden w-full">
                         <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1ca06f]"></div>
                         <div className="pl-2 w-full">
                           <div className="font-bold text-[#0f172a] text-[14px] mb-0.5 flex items-center justify-between w-full">
                             <div className="flex items-center gap-2">
                               <span>{logRow.ai_food_name || `Manual Log #${logRow.id}`}</span>
                               <span className="text-[10px] font-bold text-white bg-slate-300 px-1.5 py-0.5 rounded uppercase">Manual</span>
                             </div>
                             {displayQuantity && <span className="text-slate-500 font-bold ml-2 shrink-0">{displayQuantity}</span>}
                           </div>
                           <div className="text-[12px] text-[#64748b] flex gap-2">
                             <span className="font-medium text-[#1ca06f]">{Math.round(logRow.total_calories || 0)} kcal</span>
                             <span>• {Math.round(logRow.total_protein || 0)}g pro</span>
                             <span>• {Math.round(logRow.total_carbs || 0)}g crbs</span>
                             <span>• {Math.round(logRow.total_fat || 0)}g fat</span>
                           </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adjust Quantity Modal Overlay */}
      {adjustingItem && (
        <div className="fixed inset-0 z-[70] bg-[#0f172a]/60 flex flex-col justify-end overflow-hidden animate-in fade-in duration-200">
           <div className="bg-white w-full rounded-t-[32px] p-5 pb-8 shadow-2xl relative animate-in slide-in-from-bottom-12 duration-300 max-h-[92vh] overflow-y-auto no-scrollbar mx-auto max-w-md">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
              
              <h2 className="text-[18px] font-bold text-slate-900 mb-4 tracking-tight">Selected Food</h2>
              
              {/* Top base macro card */}
              <div className="bg-[#eaf8f1] rounded-[20px] p-4 mb-6 relative overflow-hidden">
                 <h3 className="font-bold text-[17px] text-slate-800 mb-4">{adjustingItem.assignment?.nutrition_items?.name || 'Food Item'}</h3>
                 <div className="flex justify-between items-center text-center">
                    <div>
                      <div className="text-[17px] font-bold text-slate-900">{parseFloat(adjustingItem.assignment?.nutrition_items?.calories || '0').toFixed(1).replace(/\.0$/, '')}</div>
                      <div className="text-[11px] font-medium text-slate-500">Calories</div>
                    </div>
                    <div>
                      <div className="text-[17px] font-bold text-slate-900">{parseFloat(adjustingItem.assignment?.nutrition_items?.proteins || '0').toFixed(1).replace(/\.0$/, '')}g</div>
                      <div className="text-[11px] font-medium text-slate-500">Protein</div>
                    </div>
                    <div>
                      <div className="text-[17px] font-bold text-slate-900">{parseFloat(adjustingItem.assignment?.nutrition_items?.carbs || '0').toFixed(1).replace(/\.0$/, '')}g</div>
                      <div className="text-[11px] font-medium text-slate-500">Carbs</div>
                    </div>
                    <div>
                      <div className="text-[17px] font-bold text-slate-900">{parseFloat(adjustingItem.assignment?.nutrition_items?.fats || '0').toFixed(1).replace(/\.0$/, '')}g</div>
                      <div className="text-[11px] font-medium text-slate-500">Fat</div>
                    </div>
                 </div>
              </div>

              {/* Measurement Method */}
              <div className="mb-6">
                 <h3 className="text-center font-bold text-[15px] text-slate-800 mb-3 tracking-tight">Measurement Method</h3>
                 <div className="flex bg-slate-50 border border-slate-100 rounded-xl overflow-hidden p-1 shadow-sm">
                   <button className="flex-1 py-3 text-[14px] font-medium text-slate-500 rounded-lg">Simple (x)</button>
                   <button className="flex-1 py-3 text-[14px] font-bold text-white bg-[#1ca06f] rounded-lg shadow-sm">Detailed</button>
                 </div>
              </div>

              <h3 className="font-bold text-[17px] text-slate-900 mb-4 tracking-tight">Quantity & Measure</h3>
              
              {/* selected measure display box */}
              {(() => {
                 const activeUnit = MEASURE_UNITS.find(u => u.type === adjustingItem.type);
                 let equivalentStr = '';
                 
                 if (activeUnit) {
                   if (activeUnit.displayUnit !== activeUnit.type && activeUnit.displayUnit !== 'piece') {
                     const amount = activeUnit.amountPerUnit * adjustingItem.quantity;
                     equivalentStr = `${Number.isInteger(amount) ? amount : amount.toFixed(1)}${activeUnit.displayUnit}`;
                   } else if (activeUnit.type === 'piece') {
                     // For pieces we show the gram equivalent
                     const nutrition = adjustingItem.assignment?.nutrition_items || {};
                     const m = calculateMultiplier(`${adjustingItem.quantity} ${adjustingItem.unitLabel}`, nutrition.density, nutrition.piecewise_multiplier);
                     // since M = grams/100, grams = M * 100
                     const gramsEquivalent = m * 100;
                     equivalentStr = `${Math.round(gramsEquivalent)}g`;
                   }
                 }
                    
                 return (
                    <div className="border border-[#1ca06f] rounded-xl p-4 flex justify-between items-center mb-6">
                       <div className="flex items-center gap-3 text-slate-800 font-bold text-[16px]">
                          {getUnitIcon(adjustingItem.type, false)}
                          {Number.isInteger(adjustingItem.quantity) ? adjustingItem.quantity : adjustingItem.quantity.toFixed(1)} {adjustingItem.unitLabel}
                       </div>
                       {equivalentStr && (
                         <div className="text-slate-500 font-medium text-[15px]">
                            ({equivalentStr})
                         </div>
                       )}
                    </div>
                 );
              })()}

              {/* Common Measures */}
              <div>
                 <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-3">Common Measures</p>
                 <div className="grid grid-cols-2 gap-3 mb-6">
                    {MEASURE_UNITS.map(unit => {
                       const isSelected = adjustingItem.type === unit.type;
                       return (
                          <button 
                             key={unit.type}
                             onClick={() => setAdjustingItem(prev => ({...prev, type: unit.type, unitLabel: unit.label, quantity: 1}))}
                             className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${isSelected ? 'bg-[#1ca06f] border-[#1ca06f] text-white shadow-md shadow-[#1ca06f]/20' : 'bg-white border-slate-200 text-slate-700 hover:border-[#1ca06f]/50'}`}
                          >
                             {getUnitIcon(unit.type, isSelected)}
                             <span className="text-[14px] font-bold tracking-tight">{unit.label}</span>
                          </button>
                       );
                    })}
                 </div>
              </div>

              {/* Adjuster */}
              <div className="bg-slate-50 border border-slate-100 rounded-[20px] p-5 mb-8">
                 <p className="text-[13px] font-bold text-slate-500 mb-4">Quantity:</p>
                 <div className="flex justify-center items-center gap-8">
                   <button onClick={() => {
                          const step = ['grams', 'milliliters'].includes(adjustingItem.type) ? 10 : 0.5;
                          setAdjustingItem({...adjustingItem, quantity: Math.max(0.1, adjustingItem.quantity - step)});
                       }} 
                       className="w-12 h-12 rounded-[14px] flex items-center justify-center border border-slate-200 bg-white text-[#1ca06f] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">
                      <Minus className="w-5 h-5" />
                   </button>
                   <div className="text-center w-24">
                      <div className="text-[26px] font-black text-slate-900 leading-none mb-1">
                        {Number.isInteger(adjustingItem.quantity) ? adjustingItem.quantity : adjustingItem.quantity.toFixed(1)}
                      </div>
                      <div className="text-[13px] font-bold text-slate-500 uppercase">{adjustingItem.unitLabel}</div>
                   </div>
                   <button onClick={() => {
                          const step = ['grams', 'milliliters'].includes(adjustingItem.type) ? 10 : 0.5;
                          setAdjustingItem({...adjustingItem, quantity: adjustingItem.quantity + step});
                       }} 
                       className="w-12 h-12 rounded-[14px] flex items-center justify-center border border-slate-200 bg-white text-[#1ca06f] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">
                      <Plus className="w-5 h-5" />
                   </button>
                 </div>
              </div>

              {/* Calculated Nutrition */}
              {(() => {
                 const nutrition = adjustingItem.assignment?.nutrition_items || {};
                 const m = calculateMultiplier(`${adjustingItem.quantity} ${adjustingItem.unitLabel}`, nutrition.density, nutrition.piecewise_multiplier);
                 const cal = Math.round(parseFloat(nutrition.calories || '0') * m);
                 const pro = parseFloat(nutrition.proteins || '0') * m;
                 const carbs = parseFloat(nutrition.carbs || '0') * m;
                 const fats = parseFloat(nutrition.fats || '0') * m;
                 
                 const activeUnit = MEASURE_UNITS.find(u => u.type === adjustingItem.type);
                 let equivalentStr = `${Number.isInteger(adjustingItem.quantity) ? adjustingItem.quantity : adjustingItem.quantity.toFixed(1)} ${adjustingItem.unitLabel}`;

                 if (activeUnit) {
                   if (activeUnit.displayUnit !== activeUnit.type && activeUnit.displayUnit !== 'piece') {
                     const amount = activeUnit.amountPerUnit * adjustingItem.quantity;
                     equivalentStr = `${Number.isInteger(amount) ? amount : amount.toFixed(1)}${activeUnit.displayUnit}`;
                   } else if (activeUnit.type === 'piece') {
                     const gramsEquivalent = m * 100;
                     equivalentStr = `${Math.round(gramsEquivalent)}g`;
                   }
                 }

                 return (
                   <div className="border border-[#1ca06f] rounded-2xl p-4 pt-5 pb-5 flex flex-col justify-center text-center mb-8">
                      <span className="text-[15px] font-bold text-slate-900 mb-4">Nutrition for {equivalentStr}</span>
                      <div className="flex justify-around items-center">
                         <div>
                           <div className="text-[18px] font-bold text-slate-900">{cal}</div>
                           <div className="text-[11px] font-medium text-slate-500">Calories</div>
                         </div>
                         <div>
                           <div className="text-[18px] font-bold text-slate-900">{pro.toFixed(1).replace(/\.0$/, '')}g</div>
                           <div className="text-[11px] font-medium text-slate-500">Protein</div>
                         </div>
                         <div>
                           <div className="text-[18px] font-bold text-slate-900">{carbs.toFixed(1).replace(/\.0$/, '')}g</div>
                           <div className="text-[11px] font-medium text-slate-500">Carbs</div>
                         </div>
                         <div>
                           <div className="text-[18px] font-bold text-slate-900">{fats.toFixed(1).replace(/\.0$/, '')}g</div>
                           <div className="text-[11px] font-medium text-slate-500">Fat</div>
                         </div>
                      </div>
                   </div>
                 );
              })()}

              <div className="flex gap-3">
                 <button 
                    onClick={() => setAdjustingItem(null)} 
                    className="w-[120px] bg-slate-100 text-slate-800 font-bold text-[17px] rounded-[16px] py-4 hover:bg-slate-200 active:bg-slate-300 transition-all text-center flex items-center justify-center"
                 >
                   Cancel
                 </button>
                 <button 
                    onClick={handleCustomLog}
                    disabled={adjustingItem.isUpdating}
                    className="flex-1 bg-[#1ca06f] text-white font-bold text-[17px] rounded-[16px] py-4 hover:bg-[#15895e] active:scale-[0.98] transition-all flex justify-center items-center shadow-lg shadow-[#1ca06f]/20 disabled:opacity-70"
                 >
                   {adjustingItem.isUpdating ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                   ) : (
                      (adjustingItem.assignment?.meal_id && loggedRecords[adjustingItem.assignment.meal_id]) ? "Update Log" : "Log Meal"
                   )}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Manual Search UI Modal */}
      {isSearchMode && (
        <div className="fixed inset-0 z-[60] bg-[#f8fafc] flex flex-col animate-in slide-in-from-bottom-8">
           <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-slate-100 pb-5">
             <button onClick={() => setIsSearchMode(false)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full shrink-0 transition-colors">
                <ChevronLeft className="w-6 h-6 text-slate-600" />
             </button>
             <div className="flex-1 relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search food database..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-[16px] font-medium text-slate-800 focus:ring-2 focus:ring-[#1ca06f]/20 focus:border-[#1ca06f] outline-none transition-all shadow-sm"
                />
             </div>
           </div>
           
           <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3 pb-20">
             {isSearching ? (
               <div className="text-center flex flex-col items-center justify-center text-slate-400 mt-14 space-y-3">
                  <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#1ca06f] animate-spin"></div>
                  <span className="text-sm font-bold tracking-wide">Searching database...</span>
               </div>
             ) : (
               searchResults.map(item => (
                 <div 
                   key={item.id}
                   onClick={() => {
                     openAdjustMenu({
                       meal_id: null,
                       nutrition_items: item,
                       description: '1 piece'
                     });
                   }}
                   className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-[#1ca06f]/40 active:scale-[0.98] transition-all shadow-sm group"
                 >
                   <div className="flex flex-col gap-1.5">
                     <div className="font-bold text-slate-800 text-[16px] group-hover:text-[#1ca06f] transition-colors">{item.name}</div>
                     <div className="text-[12px] text-slate-500 font-bold bg-slate-50 px-2 py-1 rounded inline-flex gap-1.5 tracking-tight w-fit">
                       <span className="text-[#1ca06f]">{parseFloat(item.calories || '0').toFixed(0)} kcal</span>
                       <span>•</span>
                       <span>{parseFloat(item.proteins || '0').toFixed(0)}g pro</span>
                       <span>•</span>
                       <span>{parseFloat(item.carbs || '0').toFixed(0)}g carbs</span>
                       <span>•</span>
                       <span>{parseFloat(item.fats || '0').toFixed(0)}g fat</span>
                     </div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-[#f0fdf4] flex items-center justify-center group-hover:bg-[#1ca06f] transition-all">
                      <Plus className="w-5 h-5 text-[#1ca06f] group-hover:text-white" />
                   </div>
                 </div>
               ))
             )}
             
             {!isSearching && searchQuery.length > 1 && searchResults.length === 0 && (
               <div className="text-center text-slate-400 mt-14 text-sm font-medium">No foods found matching "{searchQuery}"</div>
             )}

             {!isSearching && searchQuery.length < 2 && searchResults.length === 0 && (
               <div className="text-center text-slate-400 mt-14 text-sm font-medium">Type at least 2 characters to search.</div>
             )}
           </div>
        </div>
      )}
    </div>
  );
}
