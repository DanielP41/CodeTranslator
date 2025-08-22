import React, { useState, useEffect } from 'react';

// Sistema de mapeo de tipos 
const typeMapping = {
  'int': { go: 'int', php: 'int', js: 'number', csharp: 'int' },
  'float': { go: 'float64', php: 'float', js: 'number', csharp: 'double' },
  'string': { go: 'string', php: 'string', js: 'string', csharp: 'string' },
  'list': { go: '[]interface{}', php: 'array', js: 'Array', csharp: 'List<T>' },
  'array': { go: '[]float64', php: 'array', js: 'number[]', csharp: 'double[]' },
  'bool': { go: 'bool', php: 'bool', js: 'boolean', csharp: 'bool' }
};

// Sistema de mapeo de librerías
const libraryMapping = {
  'numpy': {
    go: 'gonum.org/v1/gonum/mat',
    php: 'MathPHP\\LinearAlgebra',
    javascript: 'ml-matrix',
    csharp: 'MathNet.Numerics'
  },
  'sklearn': {
    go: 'github.com/sajari/regression',
    php: 'Phpml\\Preprocessing',
    javascript: 'ml-js/ml',
    csharp: 'ML.NET'
  }
};

// Analizador de contexto
class ContextAnalyzer {
  constructor() {
    this.variables = new Map();
    this.functions = new Set();
    this.imports = new Set();
    this.dataStructures = new Map();
    this.hasBasicOperations = false;
  }

  analyzeCode(code) {
    const varMatches = code.matchAll(/(\w+)\s*=\s*(.+)/g);
    for (const match of varMatches) {
      const [, varName, value] = match;
      let type = this.inferType(value);
      this.variables.set(varName, type);
    }

    const funcMatches = code.matchAll(/def\s+(\w+)\(/g);
    for (const match of funcMatches) {
      this.functions.add(match[1]);
    }

    // Detección de operaciones básicas
    if (code.includes('print(') || code.includes('input(') || code.includes('len(')) {
      this.hasBasicOperations = true;
    }

    // Detección de importaciones
    if (code.includes('np.')) this.imports.add('numpy');
    if (code.includes('MinMaxScaler')) this.imports.add('sklearn');
    if (code.includes('np.array')) this.dataStructures.set('np.array', 'array');
    
    return {
      variables: this.variables,
      functions: this.functions,
      imports: this.imports,
      dataStructures: this.dataStructures,
      hasBasicOperations: this.hasBasicOperations
    };
  }

  inferType(value) {
    if (value.includes('[]')) return 'list';
    if (value.includes('np.array')) return 'array';
    if (/^\d+$/.test(value.trim())) return 'int';
    if (/^\d+\.\d+$/.test(value.trim())) return 'float';
    if (value.includes('"') || value.includes("'")) return 'string';
    if (value.includes('True') || value.includes('False')) return 'bool';
    return 'unknown';
  }

  getVariableType(varName) {
    return this.variables.get(varName) || 'unknown';
  }
}

// Validador de sintaxis
const validateSyntax = {
  go: (code) => {
    const issues = [];
    if (code.includes('func') && !code.match(/func\s+\w+\([^)]*\w*\s*\w*[^)]*\)\s*(\([^)]+\))?\s*{/)) {
      if (!code.includes('func main()')) {
        issues.push('Función GO necesita tipos en parámetros');
      }
    }
    if ((code.includes('fmt.Print') || code.includes('fmt.Scan')) && !code.includes('"fmt"')) {
      issues.push('Falta import "fmt"');
    }
    return issues;
  },
  php: (code) => {
    const issues = [];
    if ((code.includes('echo') || code.includes('print')) && !code.includes('<?php')) {
      issues.push('Falta etiqueta de apertura PHP');
    }
    return issues;
  },
  javascript: (code) => {
    const issues = [];
    if (code.includes('console.log') && code.includes('const') && !code.includes('let') && !code.includes('var')) {
      // Verificaciones adicionales para JS
    }
    return issues;
  },
  csharp: (code) => {
    const issues = [];
    if (code.includes('Console.Write') && !code.includes('using System')) {
      issues.push('Falta using System;');
    }
    if (code.includes('public static') && !code.includes('class')) {
      issues.push('Necesita estar dentro de una clase');
    }
    return issues;
  }
};

// Función de traducción a Go
const translateToGo = (code, context) => {
  let goCode = code;
  
  // Traducir print() básico
  goCode = goCode.replace(/print\s*\((.*?)\)/g, 'fmt.Println($1)');
  
  // Traducir input() básico
  goCode = goCode.replace(/input\s*\((.*?)\)/g, (match, prompt) => {
    return `func() string {
    fmt.Print(${prompt})
    var input string
    fmt.Scanln(&input)
    return input
  }()`;
  });

  // Traducir len()
  goCode = goCode.replace(/len\s*\(([^)]+)\)/g, 'len($1)');

  // Manejar código sin funciones (agregar main)
  if (!goCode.includes('func ') && !goCode.includes('package main')) {
    goCode = `package main

import "fmt"

func main() {
    ${goCode.split('\n').map(line => '        ' + line).join('\n')}
}`;
  } else {
    // Traducir definiciones de función
    goCode = goCode.replace(/def\s+(\w+)\((.*?)\):/g, (match, funcName, params) => {
      let typedParams = '';
      if (params.trim()) {
        typedParams = params.split(',').map(param => {
          const paramName = param.trim();
          return `${paramName} []float64`;
        }).join(', ');
      }
      return `func ${funcName}(${typedParams}) ([][]float64, []float64, error) {`;
    });

    // Agregar package e imports si no existen
    if (!goCode.includes('package main')) {
      let imports = '"fmt"';
      if (context.imports.has('numpy')) {
        imports += '\n        "math"';
      }
      goCode = `package main\n\nimport (\n        ${imports}\n)\n\n${goCode}`;
    }
  }

  // Otras traducciones específicas para ML
  goCode = goCode.replace(/(.*),\s*(.*)\s*=\s*\[\],\s*\[\]/g, (match, var1, var2) => {
    return `${var1.trim()} := make([][]float64, 0)\n          ${var2.trim()} := make([]float64, 0)`;
  });
  
  goCode = goCode.replace(/for\s+(\w+)\s+in\s+range\((.*)\):/g, 'for $1 := 0; $1 < $2; $1++ {');
  goCode = goCode.replace(/(\w+)\.append\((.*?)\)/g, '$1 = append($1, $2)');
  goCode = goCode.replace(/return\s+np\.array\((.*?)\),?\s*np\.array\((.*?)\)/g, 'return $1, $2, nil');

  // Cerrar bloques abiertos
  if (goCode.includes('{') && !goCode.trim().endsWith('}')) {
    const openBraces = (goCode.match(/{/g) || []).length;
    const closeBraces = (goCode.match(/}/g) || []).length;
    goCode += '\n' + '}'.repeat(openBraces - closeBraces);
  }

  return goCode;
};

// Función de traducción a PHP
const translateToPhp = (code, context) => {
  let phpCode = code;
  
  // Traducir print() básico
  phpCode = phpCode.replace(/print\s*\((.*?)\)/g, 'echo $1;');
  
  // Traducir input() básico
  phpCode = phpCode.replace(/input\s*\((.*?)\)/g, (match, prompt) => {
    return `(function() use ($prompt) {
    echo ${prompt};
    return trim(fgets(STDIN));
  })()`;
  });

  // Traducir len()
  phpCode = phpCode.replace(/len\s*\(([^)]+)\)/g, 'count($1)');

  // Manejar código sin funciones
  if (!phpCode.includes('function ') && !phpCode.includes('<?php')) {
    phpCode = `<?php

${phpCode}

?>`;
  } else {
    // Traducir definiciones de función
    phpCode = phpCode.replace(/def\s+(\w+)\((.*?)\):/g, 'function $1($2) {');
    
    // Agregar PHP tags si no existen
    if (!phpCode.includes('<?php')) {
      phpCode = `<?php\n\n${phpCode}\n\n?>`;
    }
  }

  // Otras traducciones específicas para ML
  phpCode = phpCode.replace(/(.*),\s*(.*)\s*=\s*\[\],\s*\[\]/g, '$$$1 = [];\n          $$$2 = [];');
  phpCode = phpCode.replace(/for\s+(\w+)\s+in\s+range\((.*)\):/g, 'for ($$1 = 0; $$1 < $2; $$1++) {');
  phpCode = phpCode.replace(/(\w+)\.append\((.*?)\)/g, 'array_push($$$1, $2);');
  phpCode = phpCode.replace(/return\s+np\.array\((.*?)\),?\s*np\.array\((.*?)\)/g, 'return array($$$1, $$$2);');

  // Cerrar bloques abiertos
  if (phpCode.includes('{') && !phpCode.trim().endsWith('}') && !phpCode.includes('?>')) {
    const openBraces = (phpCode.match(/{/g) || []).length;
    const closeBraces = (phpCode.match(/}/g) || []).length;
    phpCode += '\n' + '}'.repeat(openBraces - closeBraces);
  }

  return phpCode;
};

// Función de traducción a JavaScript
const translateToJs = (code, context) => {
  let jsCode = code;
  
  // Traducir print() básico
  jsCode = jsCode.replace(/print\s*\((.*?)\)/g, 'console.log($1)');
  
  // Traducir input() básico (Node.js style)
  jsCode = jsCode.replace(/input\s*\((.*?)\)/g, (match, prompt) => {
    return `(() => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise((resolve) => {
      rl.question(${prompt}, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  })()`;
  });

  // Traducir len()
  jsCode = jsCode.replace(/len\s*\(([^)]+)\)/g, '$1.length');

  // Traducir definiciones de función
  jsCode = jsCode.replace(/def\s+(\w+)\((.*?)\):/g, 'function $1($2) {');
  
  // Otras traducciones específicas para ML
  jsCode = jsCode.replace(/(.*),\s*(.*)\s*=\s*\[\],\s*\[\]/g, 'let $1 = [];\n          let $2 = [];');
  jsCode = jsCode.replace(/for\s+(\w+)\s+in\s+range\((.*)\):/g, 'for (let $1 = 0; $1 < $2; $1++) {');
  jsCode = jsCode.replace(/(\w+)\.append\((.*?)\)/g, '$1.push($2);');
  jsCode = jsCode.replace(/return\s+np\.array\((.*?)\),?\s*np\.array\((.*?)\)/g, 'return [$1, $2];');

  // Cerrar bloques abiertos
  if (jsCode.includes('{') && !jsCode.trim().endsWith('}')) {
    const openBraces = (jsCode.match(/{/g) || []).length;
    const closeBraces = (jsCode.match(/}/g) || []).length;
    jsCode += '\n' + '}'.repeat(openBraces - closeBraces);
  }

  return jsCode;
};

// Función de traducción a C#
const translateToCSharp = (code, context) => {
  let csharpCode = code;
  
  // Traducir print() básico
  csharpCode = csharpCode.replace(/print\s*\((.*?)\)/g, 'Console.WriteLine($1);');
  
  // Traducir input() básico
  csharpCode = csharpCode.replace(/input\s*\((.*?)\)/g, (match, prompt) => {
    return `(() => {
    Console.Write(${prompt});
    return Console.ReadLine();
  })()`;
  });

  // Traducir len()
  csharpCode = csharpCode.replace(/len\s*\(([^)]+)\)/g, '$1.Length');

  // Manejar código sin funciones (agregar Main)
  if (!csharpCode.includes('public static') && !csharpCode.includes('class')) {
    csharpCode = `using System;
using System.Collections.Generic;
using System.Linq;

public class Program
{
    public static void Main(string[] args)
    {
        ${csharpCode.split('\n').map(line => '            ' + line).join('\n')}
    }
}`;
  } else {
    // Traducir definiciones de función
    csharpCode = csharpCode.replace(/def\s+(\w+)\((.*?)\):/g, 'public static (double[][] x, double[] y) $1($2) {');
    
    // Agregar using statements y class si no existen
    if (!csharpCode.includes('using System')) {
      csharpCode = `using System;
using System.Collections.Generic;
using System.Linq;

public class MLTranslator
{
      ${csharpCode}
}`;
    }
  }

  // Otras traducciones específicas para ML
  csharpCode = csharpCode.replace(/(.*),\s*(.*)\s*=\s*\[\],\s*\[\]/g, 'var $1 = new List<double[]>();\n          var $2 = new List<double>();');
  csharpCode = csharpCode.replace(/for\s+(\w+)\s+in\s+range\((.*)\):/g, 'for (var $1 = 0; $1 < $2; $1++) {');
  csharpCode = csharpCode.replace(/(\w+)\.append\((.*?)\)/g, '$1.Add($2);');
  csharpCode = csharpCode.replace(/return\s+np\.array\((.*?)\),?\s*np\.array\((.*?)\)/g, 'return ($1.ToArray(), $2.ToArray());');

  // Cerrar bloques abiertos
  if (csharpCode.includes('{') && !csharpCode.trim().endsWith('}')) {
    const openBraces = (csharpCode.match(/{/g) || []).length;
    const closeBraces = (csharpCode.match(/}/g) || []).length;
    csharpCode += '\n' + '}'.repeat(openBraces - closeBraces);
  }

  return csharpCode;
};

function App() {
  const [pythonCode, setPythonCode] = useState(`print("Hola, Mundo")`);
  
  const [translations, setTranslations] = useState({});
  const [analysisInfo, setAnalysisInfo] = useState({});
  const [validationIssues, setValidationIssues] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [observationsData, setObservationsData] = useState('');

  const handleTranslateAll = () => {
    const analyzer = new ContextAnalyzer();
    const context = analyzer.analyzeCode(pythonCode);
    
    const goTranslation = translateToGo(pythonCode, context);
    const phpTranslation = translateToPhp(pythonCode, context);
    const jsTranslation = translateToJs(pythonCode, context);
    const csharpTranslation = translateToCSharp(pythonCode, context);

    const goIssues = validateSyntax.go(goTranslation);
    const phpIssues = validateSyntax.php(phpTranslation);
    const jsIssues = validateSyntax.javascript(jsTranslation);
    const csharpIssues = validateSyntax.csharp(csharpTranslation);

    setTranslations({
      go: goTranslation,
      php: phpTranslation,
      javascript: jsTranslation,
      csharp: csharpTranslation,
    });

    setAnalysisInfo({
      variables: Array.from(context.variables.entries()),
      functions: Array.from(context.functions),
      imports: Array.from(context.imports),
      dataStructures: Array.from(context.dataStructures.entries()),
      hasBasicOperations: context.hasBasicOperations
    });

    setValidationIssues({
      go: goIssues,
      php: phpIssues,
      javascript: jsIssues,
      csharp: csharpIssues
    });
  };

  useEffect(() => {
    handleTranslateAll();
  }, [pythonCode]);

  const getConfidenceScore = (language) => {
    const issues = validationIssues[language] || [];
    const baseScore = 95;
    const penalty = issues.length * 15;
    return Math.max(baseScore - penalty, 0);
  };

  const handleLanguageClick = (language) => {
    setSelectedLanguage(language);
    
    const confidence = getConfidenceScore(language);
    const issues = validationIssues[language] || [];
    const variables = analysisInfo.variables || [];
    const imports = analysisInfo.imports || [];
    
    let observations = `ANÁLISIS DE TRADUCCIÓN: ${language.toUpperCase()}\n\n`;
    observations += `Confianza: ${confidence}%\n\n`;
    
    if (analysisInfo.hasBasicOperations) {
      observations += `OPERACIONES BÁSICAS DETECTADAS:\n`;
      observations += `• print() → Función de salida nativa\n`;
      if (pythonCode.includes('input(')) observations += `• input() → Función de entrada nativa\n`;
      if (pythonCode.includes('len(')) observations += `• len() → Función de longitud nativa\n`;
      observations += `\n`;
    }
    
    if (imports.length > 0) {
      observations += `LIBRERÍAS DETECTADAS:\n`;
      imports.forEach(lib => {
        const equivalent = libraryMapping[lib] ? libraryMapping[lib][language] : 'No disponible';
        observations += `• ${lib} → ${equivalent}\n`;
      });
      observations += `\n`;
    }
    
    if (variables.length > 0) {
      observations += `VARIABLES Y TIPOS:\n`;
      variables.forEach(([name, type]) => {
        const mappedType = typeMapping[type] ? typeMapping[type][language] : type;
        observations += `• ${name}: ${type} → ${mappedType}\n`;
      });
      observations += `\n`;
    }
    
    if (issues.length > 0) {
      observations += `⚠️ ADVERTENCIAS:\n`;
      issues.forEach(issue => {
        observations += `• ${issue}\n`;
      });
      observations += `\n`;
    } else {
      observations += `✅ Sin advertencias de sintaxis\n\n`;
    }
    
    observations += `RECOMENDACIONES ESPECÍFICAS:\n`;
    switch(language) {
      case 'go':
        observations += `• Usar gofmt para formatear código automáticamente\n`;
        observations += `• Considerar goroutines para operaciones concurrentes\n`;
        observations += `• Implementar proper error handling\n`;
        break;
      case 'php':
        observations += `• Usar type declarations en PHP 8+\n`;
        observations += `• Considerar PSR-12 para estilo de código\n`;
        observations += `• Implementar proper exception handling\n`;
        break;
      case 'javascript':
        observations += `• Considerar usar TypeScript para type safety\n`;
        observations += `• Usar ES6+ features para código más limpio\n`;
        observations += `• Implementar proper async/await patterns\n`;
        break;
      case 'csharp':
        observations += `• Usar nullable reference types\n`;
        observations += `• Considerar record types para data objects\n`;
        observations += `• Implementar proper using statements\n`;
        break;
    }
    
    setObservationsData(observations);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <style jsx>{`
        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.3);
          border-radius: 0.5px;
        }

        ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 3px;
          border: 1px solid rgba(51, 65, 85, 0.3);
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #475569;
          box-shadow: 0 0 8px rgba(51, 65, 85, 0.4);
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: #334155 rgba(30, 41, 59, 0.3);
        }
      `}</style>
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extralight text-white mb-4 tracking-wide" style={{fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontWeight: '200'}}>TRADUCTOR DE CÓDIGO</h1>
        </div>

        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-400 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-slate-800/90 border-2 border-amber-500 rounded-2xl p-6">
              <h2 className="text-white text-lg font-semibold mb-4 text-center">Ingrese código Python</h2>
              <textarea
                className="w-full h-32 bg-slate-900 text-green-400 p-4 rounded-xl border border-slate-700 transition-all font-mono text-sm resize-none focus:outline-none focus:border-slate-700"
                value={pythonCode}
                onChange={(e) => setPythonCode(e.target.value)}
                placeholder="# Escriba su código Python aquí..."
              />
              <div className="mt-4 flex flex-wrap gap-2">          
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div 
            className="relative cursor-pointer transform transition-all duration-300 hover:scale-105"
            onClick={() => handleLanguageClick('javascript')}
          >
            
            <div className={`relative bg-slate-800/90 border-2 border-transparent rounded-2xl p-4 ${selectedLanguage === 'javascript' ? 'ring-2 ring-amber-500' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white text-lg font-light tracking-wide" style={{fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>Salida en Javascript</h3>
              </div>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64 text-xs font-mono border border-slate-700">
                <code>{translations.javascript || 'Traduciendo...'}</code>
              </pre>
            </div>
          </div>

          <div 
            className="relative cursor-pointer transform transition-all duration-300 hover:scale-105"
            onClick={() => handleLanguageClick('php')}
          >
          
            <div className={`relative bg-slate-800/90 border-2 border-transparent rounded-2xl p-4 ${selectedLanguage === 'php' ? 'ring-2 ring-amber-500' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white text-lg font-light tracking-wide" style={{fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>Salida en PHP</h3>
              </div>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64 text-xs font-mono border border-slate-700">
                <code>{translations.php || 'Traduciendo...'}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div 
            className="relative cursor-pointer transform transition-all duration-300 hover:scale-105"
            onClick={() => handleLanguageClick('go')}
          >
            <div className={`relative bg-slate-800/90 border-2 border-transparent rounded-2xl p-4 ${selectedLanguage === 'go' ? 'ring-2 ring-amber-500' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white text-lg font-light tracking-wide" style={{fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>Salida en Golang</h3>
              </div>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64 text-xs font-mono border border-slate-700">
                <code>{translations.go || 'Traduciendo...'}</code>
              </pre>
            </div>
          </div>

          <div 
            className="relative cursor-pointer transform transition-all duration-300 hover:scale-105"
            onClick={() => handleLanguageClick('csharp')}
          >
            <div className={`relative bg-slate-800/90 border-2 border-transparent rounded-2xl p-4 ${selectedLanguage === 'csharp' ? 'ring-2 ring-amber-500' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-white text-lg font-light tracking-wide" style={{fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>Salida en C#</h3>
              </div>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg overflow-auto max-h-64 text-xs font-mono border border-slate-700">
                <code>{translations.csharp || 'Traduciendo...'}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-400 rounded-2xl blur opacity-20"></div>
          <div className="relative bg-slate-800/90 border-2 border-amber-500 rounded-2xl p-6">
            <h2 className="text-white text-lg font-light tracking-wide mb-4 text-center" style={{fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>Observaciones</h2>
            <div className="bg-slate-900 rounded-xl p-4 min-h-48 border border-slate-700 overflow-auto max-h-96">
              {selectedLanguage ? (
                <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono">
                  {observationsData}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-400">
                  <div className="text-center">
                    <p>Haz clic en cualquier lenguaje para ver el análisis detallado.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;