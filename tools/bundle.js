// Builds single-file versions of the game.
//   dist/orbit-acres.html            a complete page you can double-click or send to a friend
//   dist/artifact/orbit-acres.html   the same game without the page wrapper, for publishing
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const css = ['css/style.css', 'css/ui.css'].map(read).join('\n');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const js = scripts.map(read).join('\n;\n').replace(/<\/script/g, '<\/script');
const body = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script src="https://cdnjs'));
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const three = html.match(/<script src="https:\/\/cdnjs[^>]+><\/script>/)[0];
const head = '<title>Orbit Acres</title>\n' + fonts + '\n<style>\n' + css + '\n</style>\n';
const tail = three + '\n<script>\n' + js + '\n</script>\n';
fs.mkdirSync(path.join(root, 'dist/artifact'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact/orbit-acres.html'), head + body + tail);
fs.writeFileSync(path.join(root, 'dist/orbit-acres.html'),
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">\n' + head + '</head>\n<body>\n' + body + tail + '</body>\n</html>\n');
console.log('Bundled', scripts.length, 'scripts:', (fs.statSync(path.join(root, 'dist/orbit-acres.html')).size / 1024).toFixed(0) + ' KB');
