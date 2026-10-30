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

`capa-1.svg` é a quarta, e é larga (16/6) em vez de quadrada: ela existe para
a **capa da campanha** (0050), que é uma faixa. Uma quadrada ali entraria em
`object-cover` e mostraria só a tira do meio — o protótipo pareceria um
recorte errado, e o que se quer ver na imagem é o desenho do cartão.

`retrato-1.svg` é a quinta, e ela existe por uma razão diferente das outras
quatro: **todo `avatar_url` do protótipo era nulo**, nos oito exemplos de
`dados-exemplo.ts` e nos cinco de `calendario.ts`. Quer dizer que as cento e
cinquenta imagens mostravam o produto no único estado em que ninguém da
agência tem foto — e foi isso que deixou o avatar da topbar do painel doze
sprints sem `AvatarImage` nenhum, sem nada reclamando. É a lição da Óptica
Visão sem atendente (0062) e da pessoa desligada (0069).

**Ela é 3 por 4, de propósito, e isso é o que ela prova.** O bug da foto
achatada era uma imagem não quadrada dentro de uma caixa quadrada sem
`object-fit` — uma foto quadrada no exemplo passaria com e sem o
`object-cover object-center` de `AvatarImage`, então não mediria nada. As duas
tarjas cinzas no topo e no pé são a régua: elas desaparecem no recorte certo e
aparecem esticadas se alguém tirar o `object-cover`.

**E ela não vai para todo mundo.** A Ana a tem — como persona logada e na
lista de Equipe —, o Diego é a persona SEM foto, e as outras sete da equipe
continuam nulas. Com todas de cara cheia, a imagem provaria que a foto aparece
e não que o círculo **escolhe** entre foto e iniciais — é a razão pela qual o exemplo do calendário tem um
evento de cada par da legenda, e a de só uma das duas peças aprovadas do social
estar programada.

`video-1.mp4` é o sexto, e é o primeiro que não é imagem. Ele existe porque o
item 30 abriu o upload para MP4, MOV e WEBM, e o vídeo do post passou a poder
ser **arquivo** e não só link (migration 0120): sem ele, nenhuma imagem do
protótipo mostraria o player — a tela conferida seria a que não tem a peça
nova, que é a lição da duplicata do Cronograma.

**E ele vai para UM dos dois posts de vídeo, não para os dois.** O "Reels da
receita" da Mundo Verde carrega o arquivo; o "Bastidores" da Óptica continua
com o link do YouTube. Com os dois como arquivo a imagem provaria que o player
aparece, e não que a tela **distingue** as duas formas — que é o que a 0120
existe para fazer, e é a mesma razão pela qual o exemplo do calendário tem um
evento de cada par da legenda.

Ele é 480 × 854 (9/16) porque um Reels é vertical, tem 3 segundos e 4,7 KB:
o que a imagem precisa provar é que o quadro do vídeo está no lugar e com os
controles, não o conteúdo dele. As cores são as mesmas dos SVGs, pela mesma
exceção declarada acima.
