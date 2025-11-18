// FIX: Add XLSX to the global Window interface to avoid TypeScript errors when accessing it.
// This is necessary because the library is loaded from a CDN via a script tag.
declare global {
  interface Window {
    XLSX: any;
  }
}

import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Upload, DollarSign, Users, FileText, Calculator, AlertCircle, Trash2, Save, FileSpreadsheet } from 'lucide-react';

// FIX: Define interfaces for the data structures to ensure type safety.
interface CsvRow {
  date: string;
  entrepot: string;
  tourId: string;
  driver: string;
}

interface DriverStat {
  name: string;
  tours: number;
  details: string[];
}


export default function App() {
  // Chargement de la librairie XLSX via CDN
  useEffect(() => {
    if (!window.XLSX) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialisation des états avec récupération du localStorage
  // FIX: Provide explicit types for useState hooks.
  const [csvData, setCsvData] = useState<CsvRow[]>(() => {
    const saved = localStorage.getItem('driverApp_csvData');
    return saved ? JSON.parse(saved) : [];
  });

  const [tourPrice, setTourPrice] = useState<number>(() => {
    const saved = localStorage.getItem('driverApp_tourPrice');
    return saved ? parseFloat(saved) : 80;
  });

  const [penalties, setPenalties] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem('driverApp_penalties');
    return saved ? JSON.parse(saved) : {};
  });

  const [fileName, setFileName] = useState<string | null>(() => {
    return localStorage.getItem('driverApp_fileName') || null;
  });

  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Sauvegarde automatique
  useEffect(() => {
    localStorage.setItem('driverApp_csvData', JSON.stringify(csvData));
    // FIX: Convert tourPrice number to a string for localStorage.
    localStorage.setItem('driverApp_tourPrice', tourPrice.toString());
    localStorage.setItem('driverApp_penalties', JSON.stringify(penalties));
    if (fileName) {
      localStorage.setItem('driverApp_fileName', fileName);
    } else {
      localStorage.removeItem('driverApp_fileName');
    }
    
    setIsSaved(true);
    const timer = setTimeout(() => setIsSaved(false), 1000);
    return () => clearTimeout(timer);
  }, [csvData, tourPrice, penalties, fileName]);

  // Fonction unifiée pour traiter les données (Lignes -> Objets)
  // FIX: Add types to function signature and make data parsing more robust.
  const processRows = (rows: any[][]): CsvRow[] => {
    const parsedData: CsvRow[] = [];
    // On suppose que la première ligne est l'entête, on commence à l'index 1
    // Colonnes attendues : 0:Date, 1:Entrepôt, 2:Nom(ID), 3:Livreur
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Vérification qu'il y a assez de colonnes
      if (row && row.length >= 4) {
        parsedData.push({
          date: String(row[0] ?? ''), // Date
          entrepot: String(row[1] ?? ''), // Entrepôt
          tourId: String(row[2] ?? ''), // Nom (ID Tournée)
          driver: (row[3] ?? '').toString().trim() // Livreur
        });
      }
    }
    return parsedData;
  };

  // Gestion de l'upload (CSV ou XLSX)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      // LOGIQUE EXCEL
      if (!window.XLSX) {
        setError("La librairie Excel est en cours de chargement, réessayez dans 2 secondes.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // FIX: Safely handle FileReader result, ensuring it's an ArrayBuffer.
          const result = e.target?.result;
          if (!(result instanceof ArrayBuffer)) {
            setError("Erreur lors de la lecture du fichier Excel.");
            return;
          }
          const data = new Uint8Array(result);
          const workbook = window.XLSX.read(data, { type: 'array' });
          
          // On lit la première feuille
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Conversion en tableau de tableaux (header: 1)
          const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          const processed = processRows(jsonData);
          if (processed.length === 0) {
             setError("Aucune donnée valide trouvée. Vérifiez que les colonnes sont dans l'ordre : Date, Entrepôt, Nom, Livreur.");
          } else {
             setCsvData(processed);
          }
        } catch (err) {
          console.error(err);
          setError("Erreur lors de la lecture du fichier Excel.");
        }
      };
      reader.readAsArrayBuffer(file);

    } else {
      // LOGIQUE CSV (Fallback)
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // FIX: Safely handle FileReader result, ensuring it's a string.
          const text = e.target?.result;
          if (typeof text !== 'string') {
            setError("Erreur lors de la lecture du CSV.");
            return;
          }
          const lines = text.split('\n').map(line => line.split(',')); // Split simple
          const processed = processRows(lines);
          setCsvData(processed);
        } catch (err) {
          setError("Erreur lors de la lecture du CSV.");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    if (window.confirm("Êtes-vous sûr de vouloir tout effacer ?")) {
      setCsvData([]);
      setFileName(null);
      setPenalties({});
      localStorage.removeItem('driverApp_csvData');
      localStorage.removeItem('driverApp_fileName');
      localStorage.removeItem('driverApp_penalties');
    }
  };

  // Calculs stats
  // FIX: Provide an explicit type for useMemo to ensure driverStats is correctly typed.
  const driverStats = useMemo<DriverStat[]>(() => {
    const stats: { [key: string]: DriverStat } = {};
    csvData.forEach(row => {
      const driverName = row.driver;
      if (!driverName) return;
      if (!stats[driverName]) {
        stats[driverName] = { name: driverName, tours: 0, details: [] };
      }
      stats[driverName].tours += 1;
      stats[driverName].details.push(row.tourId);
    });
    return Object.values(stats).sort((a, b) => b.tours - a.tours);
  }, [csvData]);

  const handlePenaltyChange = (driverName: string, value: string) => {
    setPenalties(prev => ({ ...prev, [driverName]: parseFloat(value) || 0 }));
  };

  const totalTours = driverStats.reduce((acc, curr) => acc + curr.tours, 0);
  const totalPenalties = Object.values(penalties).reduce((acc, curr) => acc + curr, 0);
  const totalPayout = (totalTours * tourPrice) - totalPenalties;

  const handleExport = () => {
    if (!window.XLSX) {
      setError("La librairie Excel n'est pas encore chargée. Veuillez patienter et réessayer.");
      return;
    }

    const header = ["Chauffeur", "Nb Tournées", "Montant Brut (€)", "Pénalités (€)", "Net à Payer (€)"];
    
    const data = driverStats.map(stat => {
      const grossPay = stat.tours * tourPrice;
      const penalty = penalties[stat.name] || 0;
      const netPay = grossPay - penalty;
      return [stat.name, stat.tours, grossPay, penalty, netPay];
    });
    
    const totalGross = totalTours * tourPrice;
    const totalRow = ["TOTAL", totalTours, totalGross, totalPenalties, totalPayout];

    const finalData = [header, ...data, totalRow];

    const ws = window.XLSX.utils.aoa_to_sheet(finalData);

    ws['!cols'] = [
        { wch: 30 }, // Chauffeur
        { wch: 15 }, // Nb Tournées
        { wch: 15 }, // Montant Brut
        { wch: 15 }, // Pénalités
        { wch: 15 }  // Net à Payer
    ];

    const currencyFormat = '#,##0.00" €"';
    // Start from row 2 (index 1) to skip header. Loop through data rows + total row.
    for (let i = 2; i <= data.length + 2; i++) {
        const cellCRef = `C${i}`;
        const cellDRef = `D${i}`;
        const cellERef = `E${i}`;
        if (ws[cellCRef]) { ws[cellCRef].t = 'n'; ws[cellCRef].z = currencyFormat; }
        if (ws[cellDRef]) { ws[cellDRef].t = 'n'; ws[cellDRef].z = currencyFormat; }
        if (ws[cellERef]) { ws[cellERef].t = 'n'; ws[cellERef].z = currencyFormat; }
    }

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Résumé Paie");

    const date = new Date().toISOString().slice(0, 10);
    window.XLSX.writeFile(wb, `Resume_Paie_${date}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
          {isSaved && (
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-bl-lg flex items-center gap-1 animate-fade-in-out">
              <Save className="w-3 h-3" /> Sauvegardé
            </div>
          )}
          
          <div>
            <h1 className="text-2xl font-bold text-indigo-700 flex items-center gap-2">
              <Calculator className="w-8 h-8" />
              Gestion Paie Chauffeurs
            </h1>
            <p className="text-gray-500 mt-1">Importez vos fichiers Excel (.xlsx) ou CSV.</p>
          </div>
          
          <div className="mt-4 md:mt-0 bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-center gap-4">
            <div className="text-indigo-800 font-medium">Prix par Tournée :</div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="number" 
                value={tourPrice}
                onChange={(e) => setTourPrice(parseFloat(e.target.value) || 0)}
                className="pl-8 pr-3 py-2 w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 font-bold text-right"
              />
            </div>
          </div>
        </header>

        {/* Zone d'Upload */}
        {csvData.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-400 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center pointer-events-none">
              <div className="flex gap-2 mb-4">
                <FileSpreadsheet className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Importer le fichier Excel</h3>
              <p className="text-gray-500 mt-2">Glissez votre fichier .xlsx ici ou cliquez pour parcourir</p>
              <p className="text-xs text-gray-400 mt-4">Format attendu (colonnes) : Date, Entrepôt, Nom, Livreur</p>
            </div>
          </div>
        ) : (
          /* Dashboard */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-500 text-sm font-medium uppercase">Total Tournées</h3>
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{totalTours}</div>
                <div className="text-sm text-gray-400 mt-1">Importé depuis Excel</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-500 text-sm font-medium uppercase">Total Pénalités</h3>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {totalPenalties.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-gray-500 text-sm font-medium uppercase">Total à Payer</h3>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {totalPayout.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Détail par Chauffeur
                </h2>
                <div className="flex gap-2 items-center">
                  {fileName && <span className="text-sm px-3 py-1 bg-green-50 text-green-700 rounded-full font-medium truncate max-w-[150px] flex items-center gap-1">
                     <FileSpreadsheet className="w-3 h-3" /> {fileName}
                  </span>}
                  <button 
                      onClick={handleExport}
                      className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors flex items-center gap-1"
                  >
                      <FileSpreadsheet className="w-3 h-3" /> Exporter
                  </button>
                  <button 
                      onClick={handleReset}
                      className="text-sm px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                      <Trash2 className="w-3 h-3" /> Réinitialiser
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                    <tr>
                      <th className="px-6 py-4 w-1/3">Chauffeur</th>
                      <th className="px-6 py-4 text-center">Nb Tournées</th>
                      <th className="px-6 py-4 text-right">Montant Brut</th>
                      <th className="px-6 py-4 text-center w-40">Pénalités (€)</th>
                      <th className="px-6 py-4 text-right font-bold text-gray-700">Net à Payer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {driverStats.map((stat, index) => {
                      const grossPay = stat.tours * tourPrice;
                      const penalty = penalties[stat.name] || 0;
                      const netPay = grossPay - penalty;
                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{stat.name}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-bold text-xs">{stat.tours}</span>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-600">
                            {grossPay.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          </td>
                          <td className="px-6 py-4">
                            <input 
                              type="number" min="0" placeholder="0"
                              value={penalties[stat.name] || ''}
                              onChange={(e) => handlePenaltyChange(stat.name, e.target.value)}
                              className="w-full px-3 py-1 rounded border border-gray-300 focus:border-red-500 focus:ring focus:ring-red-200 text-red-600 font-medium text-right text-sm"
                            />
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-indigo-700 text-base">
                            {netPay.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold text-gray-900">
                    <tr>
                        <td className="px-6 py-4">TOTAL</td>
                        <td className="px-6 py-4 text-center">{totalTours}</td>
                        <td className="px-6 py-4 text-right">{(totalTours * tourPrice).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                        <td className="px-6 py-4 text-right text-red-600">-{totalPenalties.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                        <td className="px-6 py-4 text-right text-lg text-indigo-700">{totalPayout.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
