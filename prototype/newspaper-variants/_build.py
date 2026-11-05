# Builds each variant's index.html from its src.html and the shared fragments.
# Run: python _build.py   (from this folder)
import pathlib
root = pathlib.Path(__file__).parent
frag = {n: (root / 'shared' / f'_{n}.html').read_text(encoding='utf8') for n in ['head', 'topline', 'coupon', 'lower', 'footer']}
frag['head'] = frag['head'].rstrip() + '\n'
# The lower sections without "How the game is played", for variants that explain it their own way.
low = frag['lower']
frag['lower_nohow'] = low[:low.index('      <section id="how">')] + low[low.index('      <section id="classifieds">'):]
frag['css'] = '''  <link rel="stylesheet" href="../../variants/base.css">
  <link rel="stylesheet" href="../../variants/board.css">
  <link rel="stylesheet" href="../shared/page.css">
  <link rel="stylesheet" href="../shared/intro.css">'''
frag['stage'] = '  <script src="../shared/stage.js"></script>'
frag['scripts'] = '''  <script src="../shared/page.js"></script>
  <script src="../../variants/common.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="../shared/intro.js"></script>'''
for src in sorted(root.glob('*/src.html')):
    out = src.read_text(encoding='utf8')
    for k, v in frag.items():
        out = out.replace('{{' + k + '}}', v.rstrip('\n'))
    (src.parent / 'index.html').write_text(out, encoding='utf8')
    print('built', src.parent.name)
