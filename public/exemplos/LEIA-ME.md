# Artes de exemplo

Três SVGs que existem só para o **seed** e para o gerador de protótipos terem
uma imagem onde a tela espera uma arte de post.

Eles usam as cores da marca escritas literalmente, e isso é uma exceção
deliberada à regra de que `globals.css` é o único arquivo com cor literal: um
SVG que vai para dentro de `<img>` não enxerga as variáveis CSS da página, e
o que se quer aqui é justamente um arquivo de imagem — não um componente.
`check:cores` varre `src/`, e estes arquivos não moram lá.

Nenhum deles é material de cliente. Se um dia aparecerem numa tela de
produção, é bug.
