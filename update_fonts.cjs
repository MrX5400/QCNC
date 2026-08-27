const fs = require('fs');

function updateCanvasFonts(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Inject uiScale if not there
  if (!content.includes('const { theme, t, uiScale } = useThemeLanguage();')) {
    content = content.replace(
      /const \{\s*theme,\s*t\s*\}\s*=\s*useThemeLanguage\(\);/g,
      'const { theme, t, uiScale } = useThemeLanguage();'
    );
  }

  // Replace ctx.font = 'bold 10px monospace';
  // with ctx.font = `bold ${Math.round(10 * uiScale / 100)}px monospace`;
  content = content.replace(/ctx\.font\s*=\s*'(.*?)(\d+)px([^']+)';/g, (match, prefix, size, suffix) => {
    return 'ctx.font = `' + prefix + '${Math.round(' + size + ' * (uiScale || 100) / 100)}px' + suffix + '`;';
  });

  fs.writeFileSync(filePath, content);
}

updateCanvasFonts('src/components/Visualizer2D3D.tsx');
updateCanvasFonts('src/components/GeneratorSuite.tsx');
