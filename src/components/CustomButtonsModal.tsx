import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  SlidersHorizontal,
  Square, 
  Zap, 
  Home, 
  Crosshair, 
  Target, 
  Wind, 
  Unlock, 
  Power, 
  Flame, 
  Navigation, 
  Move,
  Edit2,
  Copy,
  Play,
  Search,
  BookOpen,
  Sparkles,
  Layers,
  AlertCircle,
  PenTool,
  Info,
  Terminal,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { 
  CustomButton, 
  MacroCategory,
  MACRO_CATEGORIES,
  DEFAULT_CUSTOM_BUTTONS, 
  MACRO_TEMPLATES_LIBRARY,
  loadCustomButtons, 
  saveCustomButtons, 
  exportCustomButtonsJson, 
  importCustomButtonsJson,
  executeMacroSequence,
  substituteMacroVariables
} from '../services/customButtonsService';
import { MachineProfile, ParsedGcode } from '../types/cnc';
import { grbl } from '../services/grblService';

interface CustomButtonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile?: MachineProfile;
  parsedGcode?: ParsedGcode | null;
  onButtonsUpdated?: () => void;
}

export const CustomButtonsModal: React.FC<CustomButtonsModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  parsedGcode = null,
  onButtonsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'templates' | 'backup'>('list');
  const [buttons, setButtons] = useState<CustomButton[]>(() => loadCustomButtons());
  const [selectedCategory, setSelectedCategory] = useState<MacroCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>([]);
  
  // Editor State
  const [editingButton, setEditingButton] = useState<CustomButton | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [editorCursorPos, setEditorCursorPos] = useState<number>(0);
  const [testOutput, setTestOutput] = useState<{ status: 'idle' | 'running' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commandTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fallback profile if not provided
  const activeProfile: MachineProfile = currentProfile || {
    id: 'default',
    name: 'Plotter CNC',
    bedWidth: 300,
    bedHeight: 200,
    bedDepth: 40,
    origin: 'bottom_left',
    penUpCommand: 'M3 S0',
    penDownCommand: 'M3 S1000',
    penUpZ: 5,
    penDownZ: 0,
    travelFeedrate: 2500,
    drawingFeedrate: 1200,
    laserPowerMax: 1000,
  };

  useEffect(() => {
    if (isOpen) {
      setButtons(loadCustomButtons());
      setSelectedButtonIds([]);
      setTestOutput({ status: 'idle', message: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (text: string, isError: boolean = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const renderIcon = (iconName: string, className: string = 'w-4 h-4') => {
    switch (iconName) {
      case 'Square': return <Square className={className} />;
      case 'Zap': return <Zap className={className} />;
      case 'Home': return <Home className={className} />;
      case 'Crosshair': return <Crosshair className={className} />;
      case 'Target': return <Target className={className} />;
      case 'Wind': return <Wind className={className} />;
      case 'Unlock': return <Unlock className={className} />;
      case 'RotateCcw': return <RotateCcw className={className} />;
      case 'Power': return <Power className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Navigation': return <Navigation className={className} />;
      case 'Move': return <Move className={className} />;
      case 'PenTool': return <PenTool className={className} />;
      case 'Info': return <Info className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Terminal': return <Terminal className={className} />;
      case 'CornerDownLeft': return <CornerDownLeft className={className} />;
      default: return <Zap className={className} />;
    }
  };

  const getColorClasses = (color: CustomButton['color']) => {
    switch (color) {
      case 'purple': return 'bg-purple-950/50 text-purple-300 border-purple-800/60';
      case 'rose': return 'bg-rose-950/50 text-rose-300 border-rose-800/60';
      case 'cyan': return 'bg-cyan-950/50 text-cyan-300 border-cyan-800/60';
      case 'teal': return 'bg-teal-950/50 text-teal-300 border-teal-800/60';
      case 'blue': return 'bg-blue-950/50 text-blue-300 border-blue-800/60';
      case 'emerald': return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60';
      case 'amber': return 'bg-amber-950/50 text-amber-300 border-amber-800/60';
      case 'indigo': return 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60';
      case 'slate':
      default: return 'bg-slate-900/90 text-slate-300 border-slate-700';
    }
  };

  // Visibility toggle
  const handleToggleVisibility = (id: string) => {
    const updated = buttons.map(b => b.id === id ? { ...b, isVisible: !b.isVisible } : b);
    setButtons(updated);
    saveCustomButtons(updated);
    if (onButtonsUpdated) onButtonsUpdated();
  };

  // Reorder single item
  const handleMoveOrder = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const copy = [...buttons];
    const item = copy.splice(index, 1)[0];
    
    if (direction === 'top') {
      copy.unshift(item);
    } else if (direction === 'bottom') {
      copy.push(item);
    } else if (direction === 'up') {
      const targetIdx = Math.max(0, index - 1);
      copy.splice(targetIdx, 0, item);
    } else if (direction === 'down') {
      const targetIdx = Math.min(copy.length, index + 1);
      copy.splice(targetIdx, 0, item);
    }

    const reindexed = copy.map((b, i) => ({ ...b, order: i }));
    setButtons(reindexed);
    saveCustomButtons(reindexed);
    if (onButtonsUpdated) onButtonsUpdated();
  };

  // Delete single item
  const handleDeleteButton = (id: string) => {
    const updated = buttons.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i }));
    setButtons(updated);
    setSelectedButtonIds(prev => prev.filter(item => item !== id));
    saveCustomButtons(updated);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification('Makro gelöscht');
  };

  // Duplicate / Clone macro
  const handleDuplicateButton = (btn: CustomButton) => {
    const duplicate: CustomButton = {
      ...btn,
      id: 'btn_' + Math.random().toString(36).substring(2, 9),
      name: `${btn.name} (Kopie)`,
      order: buttons.length,
      isVisible: true,
    };
    const updated = [...buttons, duplicate];
    setButtons(updated);
    saveCustomButtons(updated);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification(`Kopie erstellt: ${duplicate.name}`);
  };

  // Save edit/create
  const handleSaveEdit = (btn: CustomButton) => {
    if (!btn.name.trim()) {
      showNotification('Bitte einen Namen für das Makro angeben', true);
      return;
    }
    if (!btn.command.trim()) {
      showNotification('Bitte mindestens einen G-Code Befehl angeben', true);
      return;
    }

    let updated: CustomButton[];
    const exists = buttons.some(b => b.id === btn.id);
    if (exists) {
      updated = buttons.map(b => b.id === btn.id ? btn : b);
    } else {
      updated = [...buttons, { ...btn, order: buttons.length }];
    }
    setButtons(updated);
    saveCustomButtons(updated);
    setEditingButton(null);
    setIsCreatingNew(false);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification('Makro erfolgreich gespeichert!');
  };

  // Direct Live Test Runner
  const handleTestMacro = async (macro: CustomButton) => {
    setTestOutput({ status: 'running', message: 'Führe Makro aus...' });
    try {
      const res = await executeMacroSequence(macro, activeProfile, parsedGcode);
      if (res.success) {
        setTestOutput({ status: 'success', message: res.message });
        showNotification(res.message);
      } else {
        setTestOutput({ status: 'error', message: res.message });
        showNotification(res.message, true);
      }
    } catch (err: any) {
      setTestOutput({ status: 'error', message: err.message || 'Ausführungsfehler' });
      showNotification(err.message || 'Ausführungsfehler', true);
    }
  };

  // Add Template to user's list
  const handleAddTemplate = (template: typeof MACRO_TEMPLATES_LIBRARY[0]) => {
    const newBtn: CustomButton = {
      ...template,
      id: 'btn_' + Math.random().toString(36).substring(2, 9),
      order: buttons.length,
      isVisible: true,
    };
    const updated = [...buttons, newBtn];
    setButtons(updated);
    saveCustomButtons(updated);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification(`Vorlage hinzugefügt: ${newBtn.name}`);
  };

  // Batch actions
  const handleBatchToggleVisibility = (visible: boolean) => {
    if (selectedButtonIds.length === 0) return;
    const updated = buttons.map(b => selectedButtonIds.includes(b.id) ? { ...b, isVisible: visible } : b);
    setButtons(updated);
    saveCustomButtons(updated);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification(`${selectedButtonIds.length} Makros ${visible ? 'eingeblendet' : 'ausgeblendet'}`);
  };

  const handleBatchDelete = () => {
    if (selectedButtonIds.length === 0) return;
    const updated = buttons.filter(b => !selectedButtonIds.includes(b.id)).map((b, i) => ({ ...b, order: i }));
    setButtons(updated);
    setSelectedButtonIds([]);
    saveCustomButtons(updated);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification('Ausgewählte Makros gelöscht');
  };

  // Export / Import
  const handleExport = () => {
    const jsonStr = exportCustomButtonsJson(buttons, selectedButtonIds.length > 0 ? selectedButtonIds : undefined);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plottercnc_makros_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`${selectedButtonIds.length > 0 ? selectedButtonIds.length : buttons.length} Makros exportiert!`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importCustomButtonsJson(text, buttons);
        setButtons(imported);
        if (onButtonsUpdated) onButtonsUpdated();
        showNotification('Makros erfolgreich importiert!');
      } catch (err: any) {
        showNotification('Fehler beim Importieren: ' + (err.message || 'Ungültige Datei'), true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRestoreDefaults = () => {
    const reset: CustomButton[] = JSON.parse(JSON.stringify(DEFAULT_CUSTOM_BUTTONS));
    setButtons(reset);
    setSelectedButtonIds([]);
    saveCustomButtons(reset);
    if (onButtonsUpdated) onButtonsUpdated();
    showNotification('Standard-Makros (18 Vorlagen) wiederhergestellt!');
  };

  // Insert variable into editor textarea
  const insertVariableIntoEditor = (varName: string) => {
    if (!editingButton) return;
    const current = editingButton.command || '';
    const pos = commandTextareaRef.current?.selectionStart ?? current.length;
    const newText = current.slice(0, pos) + varName + current.slice(pos);
    setEditingButton({ ...editingButton, command: newText });
    setTimeout(() => {
      if (commandTextareaRef.current) {
        commandTextareaRef.current.focus();
        commandTextareaRef.current.setSelectionRange(pos + varName.length, pos + varName.length);
      }
    }, 50);
  };

  // Filtered buttons
  const filteredButtons = buttons.filter(btn => {
    const matchCategory = selectedCategory === 'all' || btn.category === selectedCategory;
    const matchSearch = !searchQuery.trim() || 
      btn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (btn.description && btn.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      btn.command.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const iconsList = ['Square', 'Zap', 'Home', 'Crosshair', 'Target', 'Wind', 'Unlock', 'RotateCcw', 'Power', 'Flame', 'Navigation', 'Move', 'PenTool', 'Info', 'Sparkles', 'Terminal', 'CornerDownLeft'];
  const colorsList: CustomButton['color'][] = ['indigo', 'cyan', 'teal', 'blue', 'emerald', 'amber', 'rose', 'purple', 'slate'];

  const variableChips = [
    { label: '{bedCenterX}', desc: 'Mitte X' },
    { label: '{bedCenterY}', desc: 'Mitte Y' },
    { label: '{bedWidthMinus10}', desc: 'X Max - 10mm' },
    { label: '{bedHeightMinus10}', desc: 'Y Max - 10mm' },
    { label: '{penUpCommand}', desc: 'Stift Hoch' },
    { label: '{penDownCommand}', desc: 'Stift Runter' },
    { label: '{penUpZ}', desc: 'Z-Sicherheitshöhe' },
    { label: '{travelFeedrate}', desc: 'Eilgang F' },
    { label: '{drawingFeedrate}', desc: 'Zeichen F' },
    { label: '{currentX}', desc: 'Aktuelles X' },
    { label: '{currentY}', desc: 'Aktuelles Y' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-950/80 border border-purple-800/60 rounded-lg text-purple-300">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Makro- & Schnellaktions-Verwaltung</span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono font-normal">
                  {buttons.filter(b => b.isVisible).length} / {buttons.length} aktiv
                </span>
              </h2>
              <p className="text-[0.6875rem] text-slate-400">
                Erstelle, ordne und teste benutzerdefinierte G-Code Sequenzen, Laser-Pulse und Fahrbefehle.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'list'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Meine Makros ({buttons.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'templates'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Vorlagen-Bibliothek ({MACRO_TEMPLATES_LIBRARY.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'backup'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Backup &amp; Reset</span>
            </button>
          </div>

          {activeTab === 'list' && (
            <button
              onClick={() => {
                setIsCreatingNew(true);
                setEditingButton({
                  id: 'btn_' + Math.random().toString(36).substring(2, 9),
                  name: 'Neues Makro',
                  description: 'Beschreibung des Makros...',
                  category: 'custom',
                  command: 'G90\n{penUpCommand}\nG0 X0 Y0 F{travelFeedrate}',
                  color: 'indigo',
                  icon: 'Zap',
                  requireConfirmation: false,
                  isVisible: true,
                  order: buttons.length,
                });
                setTestOutput({ status: 'idle', message: '' });
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neues Makro anlegen</span>
            </button>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`px-4 py-1.5 text-xs flex items-center gap-2 border-b animate-fade-in ${
            toast.isError
              ? 'bg-rose-950/80 border-rose-800 text-rose-300'
              : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
          }`}>
            {toast.isError ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          
          {/* TAB 1: MEINE MAKROS */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {/* Category Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <div className="flex flex-wrap items-center gap-1">
                  {MACRO_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Makros durchsuchen..."
                    className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Batch Action Bar if items selected */}
              {selectedButtonIds.length > 0 && (
                <div className="bg-indigo-950/70 border border-indigo-800/80 p-2 rounded-lg flex items-center justify-between text-xs animate-fade-in">
                  <div className="flex items-center gap-2 text-indigo-200 font-semibold">
                    <span>{selectedButtonIds.length} Makros ausgewählt</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleBatchToggleVisibility(true)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-700"
                    >
                      Einblenden
                    </button>
                    <button
                      onClick={() => handleBatchToggleVisibility(false)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-700"
                    >
                      Ausblenden
                    </button>
                    <button
                      onClick={handleExport}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-300 rounded border border-slate-700 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Exportieren</span>
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Löschen</span>
                    </button>
                    <button
                      onClick={() => setSelectedButtonIds([])}
                      className="px-2 py-1 text-slate-400 hover:text-slate-200"
                    >
                      Abwählen
                    </button>
                  </div>
                </div>
              )}

              {/* Macro Cards List */}
              <div className="space-y-1.5">
                {filteredButtons.map((btn, idx) => (
                  <div
                    key={btn.id}
                    className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      btn.isVisible
                        ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/30 border-slate-900 opacity-60'
                    }`}
                  >
                    {/* Left: Checkbox + Order buttons + Icon + Title */}
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedButtonIds.includes(btn.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedButtonIds(prev => [...prev, btn.id]);
                          } else {
                            setSelectedButtonIds(prev => prev.filter(id => id !== btn.id));
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        title="Auswählen"
                      />

                      {/* Order Controls */}
                      <div className="flex flex-col">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveOrder(idx, 'up')}
                          className="text-slate-500 hover:text-slate-200 disabled:opacity-20 p-0.5 transition-colors"
                          title="Nach oben verschieben"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === buttons.length - 1}
                          onClick={() => handleMoveOrder(idx, 'down')}
                          className="text-slate-500 hover:text-slate-200 disabled:opacity-20 p-0.5 transition-colors"
                          title="Nach unten verschieben"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Icon & Color Badge */}
                      <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${getColorClasses(btn.color)}`}>
                        {renderIcon(btn.icon)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-100">{btn.name}</span>
                          {btn.requireConfirmation && (
                            <span className="text-[0.5625rem] bg-amber-950/80 text-amber-300 border border-amber-800 px-1 py-0.2 rounded" title="Sicherheitsabfrage aktiv">
                              Bestätigung
                            </span>
                          )}
                          <span className="text-[0.625rem] text-slate-500 font-mono">
                            {btn.category}
                          </span>
                        </div>
                        {btn.description && (
                          <p className="text-[0.6875rem] text-slate-400 line-clamp-1">
                            {btn.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Middle: Command Preview */}
                    <div className="hidden md:block flex-1 max-w-[260px] truncate text-[0.625rem] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800/80">
                      {btn.command.replace(/\n/g, ' ↵ ')}
                    </div>

                    {/* Right Actions: Test Run, Toggle Visibility, Edit, Clone, Delete */}
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      {/* Test Execute Button */}
                      <button
                        onClick={() => handleTestMacro(btn)}
                        className="px-2 py-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 hover:text-white rounded border border-purple-800/50 text-[0.6875rem] font-medium flex items-center gap-1 transition-colors"
                        title="Makro jetzt ausführen / testen"
                      >
                        <Play className="w-3 h-3" />
                        <span className="hidden lg:inline">Testen</span>
                      </button>

                      {/* Visibility Toggle */}
                      <button
                        onClick={() => handleToggleVisibility(btn.id)}
                        className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                          btn.isVisible
                            ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900'
                            : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
                        }`}
                        title={btn.isVisible ? 'In Makroleiste eingeblendet' : 'Ausgeblendet'}
                      >
                        {btn.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setIsCreatingNew(false);
                          setEditingButton({ ...btn });
                          setTestOutput({ status: 'idle', message: '' });
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                        title="Makro bearbeiten"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicateButton(btn)}
                        className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded border border-slate-800 transition-colors"
                        title="Makro duplizieren"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteButton(btn.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded border border-slate-800 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {filteredButtons.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Keine Makros für diese Kategorie oder Suchanfrage gefunden.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VORLAGEN BIBLIOTHEK */}
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <h3 className="font-bold text-slate-200">Fertige Makro-Vorlagen für Plotter, CNC &amp; Laser</h3>
                  <p className="text-slate-400 text-[0.6875rem]">
                    Füge bewährte CNC-Befehle mit einem Klick zu deinen Makros hinzu.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {MACRO_TEMPLATES_LIBRARY.map((tpl, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col justify-between gap-2.5 hover:border-purple-800/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded ${getColorClasses(tpl.color)}`}>
                            {renderIcon(tpl.icon, 'w-3.5 h-3.5')}
                          </div>
                          <span className="font-bold text-xs text-slate-100">{tpl.name}</span>
                        </div>
                        <span className="text-[0.625rem] text-slate-500 font-mono">
                          {tpl.category}
                        </span>
                      </div>
                      <p className="text-[0.6875rem] text-slate-400 mt-1.5">
                        {tpl.description}
                      </p>
                      <div className="mt-2 bg-slate-900 p-1.5 rounded font-mono text-[0.625rem] text-slate-300 border border-slate-800/80 max-h-16 overflow-y-auto whitespace-pre-line">
                        {tpl.command}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddTemplate(tpl)}
                      className="w-full py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Zu meinen Makros hinzufügen</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BACKUP & EXPORT/IMPORT */}
          {activeTab === 'backup' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Export Card */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <Download className="w-4 h-4" />
                    <span>Makros Exportieren</span>
                  </div>
                  <p className="text-slate-400 text-[0.6875rem]">
                    Sichere alle {buttons.length} konfigurierten Makros als wiederverwendbare JSON-Datei.
                  </p>
                  <button
                    onClick={handleExport}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Als .json exportieren</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <Upload className="w-4 h-4" />
                    <span>Makros Importieren</span>
                  </div>
                  <p className="text-slate-400 text-[0.6875rem]">
                    Lade eine zuvor exportierte Makro-Konfigurationsdatei hoch und führe sie zusammen.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>JSON-Datei wählen</span>
                  </button>
                </div>

                {/* Reset Defaults Card */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <RotateCcw className="w-4 h-4" />
                    <span>Standard Wiederherstellen</span>
                  </div>
                  <p className="text-slate-400 text-[0.6875rem]">
                    Stellt alle 18 Standard-Makros und empfohlenen Werkzeugaktionen wieder her.
                  </p>
                  <button
                    onClick={handleRestoreDefaults}
                    className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>18 Standard-Makros laden</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit / Create Form Modal Sub-overlay */}
        {editingButton && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${getColorClasses(editingButton.color)}`}>
                    {renderIcon(editingButton.icon)}
                  </div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {isCreatingNew ? 'Neues Makro erstellen' : 'Makro bearbeiten'}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingButton(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 text-xs pr-1">
                {/* Name & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Name / Beschriftung:</label>
                    <input
                      type="text"
                      value={editingButton.name}
                      onChange={(e) => setEditingButton({ ...editingButton, name: e.target.value })}
                      placeholder="z.B. Laser Fokus Test"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Kategorie:</label>
                    <select
                      value={editingButton.category}
                      onChange={(e) => setEditingButton({ ...editingButton, category: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      {MACRO_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Beschreibung / Tooltip:</label>
                  <input
                    type="text"
                    value={editingButton.description || ''}
                    onChange={(e) => setEditingButton({ ...editingButton, description: e.target.value })}
                    placeholder="Kurze Erklärung der Funktion..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* G-Code Command Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">
                      G-Code Befehle (Mehrzeilig, Variablen möglich):
                    </label>
                    <span className="text-[0.625rem] text-slate-500">
                      Spezial: FRAMING_ACTION, AIR_ASSIST_TOGGLE, GRBL_SOFT_RESET
                    </span>
                  </div>
                  <textarea
                    ref={commandTextareaRef}
                    rows={5}
                    value={editingButton.command}
                    onChange={(e) => setEditingButton({ ...editingButton, command: e.target.value })}
                    placeholder="G90&#10;G0 Z{penUpZ}&#10;G0 X{bedCenterX} Y{bedCenterY} F{travelFeedrate}"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 font-mono text-[0.6875rem] text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Clickable Variable Chips */}
                <div>
                  <label className="block text-slate-400 mb-1 text-[0.6875rem] font-medium">
                    Klickbare Platzhalter-Variablen einfügen:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {variableChips.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => insertVariableIntoEditor(chip.label)}
                        className="px-2 py-0.5 bg-slate-950 hover:bg-purple-950/70 text-purple-300 hover:text-purple-200 border border-slate-800 hover:border-purple-600 rounded text-[0.625rem] font-mono transition-colors"
                        title={chip.desc}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Preview of Substituted G-Code */}
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[0.625rem] text-slate-500 font-semibold block mb-0.5">
                    Vorschau (aufgelöste Variablen für aktuelles Profil):
                  </span>
                  <div className="font-mono text-[0.625rem] text-emerald-400 max-h-16 overflow-y-auto whitespace-pre-line">
                    {substituteMacroVariables(editingButton.command, activeProfile)}
                  </div>
                </div>

                {/* Color & Icon Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Farbe:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {colorsList.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingButton({ ...editingButton, color: c })}
                          className={`px-2 py-1 rounded text-[0.625rem] font-semibold border transition-all ${
                            editingButton.color === c
                              ? 'ring-2 ring-white ' + getColorClasses(c)
                              : getColorClasses(c)
                          }`}
                        >
                          {c.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Icon:</label>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-800">
                      {iconsList.map(ic => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setEditingButton({ ...editingButton, icon: ic })}
                          className={`p-1.5 rounded transition-colors ${
                            editingButton.icon === ic
                              ? 'bg-purple-600 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                          title={ic}
                        >
                          {renderIcon(ic, 'w-3.5 h-3.5')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={editingButton.requireConfirmation || false}
                      onChange={(e) => setEditingButton({ ...editingButton, requireConfirmation: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>Sicherheitsabfrage vor Ausführung anzeigen</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={editingButton.isVisible}
                      onChange={(e) => setEditingButton({ ...editingButton, isVisible: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <span>In Makroleiste einblenden</span>
                  </label>
                </div>

                {/* Live Test Inside Modal */}
                {testOutput.status !== 'idle' && (
                  <div className={`p-2 rounded-lg border text-xs flex items-center gap-2 animate-fade-in ${
                    testOutput.status === 'running'
                      ? 'bg-purple-950/80 border-purple-800 text-purple-300'
                      : testOutput.status === 'success'
                      ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border-rose-800 text-rose-300'
                  }`}>
                    {testOutput.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {testOutput.status === 'success' && <Check className="w-3.5 h-3.5" />}
                    {testOutput.status === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{testOutput.message}</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTestMacro(editingButton)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Befehl jetzt testen</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingButton(null)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(editingButton)}
                    className="px-4 py-1.5 rounded-lg text-xs bg-indigo-600 text-white hover:bg-indigo-500 font-semibold shadow-sm"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Tipp: Du kannst die Makroleiste im Hauptfenster über den kleinen Pfeil auch komplett minimieren.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
