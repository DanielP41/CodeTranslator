// src/App.jsx
import React, { useState } from 'react';

function App() {
  // Estado para almacenar el código Python ingresado por el usuario
  const [pythonCode, setPythonCode] = useState("");
  // Estado para almacenar las traducciones a diferentes lenguajes
  const [translations, setTranslations] = useState({});

  // Función para traducir el código Python a Go, PHP y JavaScript
  const translateCode = () => {
    // Traducción simple de 'print' a 'fmt.Println' y 'x =' a 'var x :=' para Go
    const goCode = pythonCode.replace('print', 'fmt.Println').replace('x =', 'var x :=');
    // Traducción simple de 'print' a 'echo' y eliminación de ';' para PHP
    // Nota: La interpolación de $pythonCode dentro de un string PHP requiere cuidado si el código Python contiene comillas.
    const phpCode = `<?php echo ${pythonCode.replace("print", "echo").replace(";", "")}; ?>`;
    // Traducción simple de 'print' a 'console.log' para JavaScript
    const jsCode = pythonCode.replace('print', 'console.log');

    // Actualiza el estado de las traducciones
    setTranslations({ go: goCode, php: phpCode, javascript: jsCode });
  };

  return (
    // Contenedor principal de la aplicación con estilos de Tailwind CSS
    // La clase 'bg-red-500' se usa para verificar si Tailwind CSS está funcionando.
    <div className="container mx-auto p-4 bg-red-500 rounded-lg shadow-lg min-h-screen flex flex-col justify-center items-center">
      {/* Título de la aplicación */}
      <h1 className="text-4xl font-bold text-white mb-6">Traductor de Código</h1>

      {/* Área de texto para ingresar el código Python */}
      <textarea
        className="w-full max-w-2xl p-4 mb-6 border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500"
        value={pythonCode}
        onChange={(e) => setPythonCode(e.target.value)}
        placeholder="Escribe código Python aquí..."
        rows="10" // Define el número de filas visibles
      ></textarea>

      {/* Botón para iniciar la traducción */}
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 shadow-md"
        onClick={translateCode}
      >
        Traducir
      </button>

      {/* Contenedor para mostrar las traducciones */}
      <div className="mt-8 w-full max-w-2xl">
        {/* Mapea sobre las traducciones y las muestra */}
        {Object.entries(translations).map(([lang, code]) => (
          <div key={lang} className="mb-6 bg-gray-700 p-4 rounded-lg shadow-inner">
            {/* Título para el lenguaje traducido */}
            <h2 className="text-2xl font-semibold text-white mb-3">{lang.toUpperCase()}</h2>
            {/* Área preformateada para mostrar el código traducido */}
            <pre className="bg-gray-800 text-green-300 p-4 rounded-md overflow-x-auto text-sm leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
