# Visualizador de Confrontos — Major CS2 (fase suíça)

## Intenção e porquê
Ferramenta para você e seus amigos visualizarem, antes e durante cada stage suíço
do Major, **a probabilidade de cada time enfrentar cada outro time** ao longo da
fase. O valor está em ver como pequenas mudanças de resultado reorganizam os
confrontos possíveis — e em deixar claro quais pares *não podem* se enfrentar.
Uso principal: antes de cada stage. Uso secundário: ao vivo, travando resultados
já ocorridos e vendo tudo recalcular, numa roda de amigos.

## Objetivos
- Dado os 16 times, suas seeds e sua força, estimar P(X enfrenta Y) no stage.
- Respeitar as regras reais de pareamento do Major: seed inicial, grupos de
  record, ordenação por Buchholz, e **sem revanche** dentro do stage.
- Visualização principal: matriz/mapa de calor de confrontos (16×16).
- Permitir **travar resultados** já ocorridos e recalcular (análise ao vivo).
- Permitir **ajustar a força** de cada time e dar **override manual** em
  confrontos específicos ("esse número tá errado").

## Não-objetivos
- Otimizador de pick'em (saiu de escopo; só confrontos).
- Stage 3 / playoffs de mata-mata — foco nas fases suíças de 16 times.
- Scraping automático de HLTV/majors.im. Os números entram na mão (16 valores).
  Conveniência opcional futura: puxar força via HLTV-api
  (github.com/Gabrielcnetto/HLTV-api) — só se a entrada manual incomodar e o
  CORS/backend permitir; não bloqueia a v1.
- Contas exatas por enumeração completa (ver Abordagens).

## Anti-objetivos (o que seria fracasso mesmo "funcionando")
- Números de confronto errados por pareamento incorreto. É a coisa que mais
  importa; um mapa de calor bonito com probabilidades erradas é pior que nada.
- Precisar de servidor, build, ou instalação pra abrir na roda de amigos.

## Restrições
- Um arquivo HTML autossuficiente, roda no navegador (inclusive celular).
- Sem backend, sem dependências de rede em tempo de uso.
- Simulação precisa rodar em < ~1s pra "travar resultado e ver recalcular" ser fluido.

## Abordagens consideradas
- **Monte Carlo em página HTML (ESCOLHIDA).** Roda o stage N vezes (default 200k),
  pareando pelas regras e decidindo cada jogo pela força; P(X vs Y) = frequência.
  Precisão ±0,1% com folga, roda em milissegundos a ~1s em JS puro. Zero infra.
- *Enumeração exata / DP* — descartada: ~10¹⁰⁺ caminhos; muito mais engenharia pra
  um ganho imperceptível num mapa de calor.
- *Notebook Python* — descartada: ruim pra visualizar e mexer junto ao vivo.
- *App com servidor (Streamlit)* — descartada: overkill, o cálculo é minúsculo.

## Decisões de como-fazer (minhas escolhas, salvo onde marcado "seu")
- **Estrutura vs força — dois inputs separados.** Seed (da foto que você manda)
  governa o pareamento e o desempate de Buchholz. Força (HLTV) governa quem ganha
  cada jogo. São coisas diferentes e não precisam ter a mesma ordem.
- **Pareamento (o núcleo de corretude):**
  - Rodada 1: seed N vs seed N+8 (1×9 … 8×16).
  - Rodadas seguintes: agrupar por record; dentro do grupo, ordenar por Buchholz
    (soma de W−L dos adversários já enfrentados), desempate pela seed inicial;
    parear alto-vs-baixo dentro do grupo.
  - **Sem revanche:** quando o pareamento alto-vs-baixo geraria uma revanche,
    deslocar os pares pelo procedimento definido da Valve. Esta é a parte que
    erra fácil.
  - **Validação obrigatória:** conferir o pareamento contra um bracket real já
    conhecido do majors.im antes de confiar em qualquer número.
- **Probabilidade de cada partida:** logística na diferença de força (derivada dos
  pontos HLTV), com **um knob global de zebra** pra calibrar. MD3 (rodadas
  decisivas) usa a prob. de Bo3 derivada da prob. de mapa único: p²(3−2p).
  **Override manual** por confronto por cima disso. *(modelo seu, já aprovado em conversa)*
- **Entradas de dados:** 16 times com nome, seed e um valor de força; editáveis na
  própria página. Travar resultado = fixar o vencedor de uma partida específica já
  ocorrida; a simulação condiciona nisso.
- **Visualização:** matriz 16×16 (mapa de calor) de P(confronto); células de pares
  impossíveis marcadas distintamente (0 estrutural vs 0 por já terem se enfrentado).
  Secundário: por time, lista ordenada de adversários mais prováveis.

## O que fica a cargo do builder (eu, na implementação)
- Formato exato do input de força (pontos HLTV crus vs rating normalizado) e o
  valor default do knob de zebra — calibro pra "fazer sentido" e deixo ajustável.
- Procedimento preciso de desvio de revanche — implemento conforme a regra Valve
  e travo com a validação contra majors.im.
- Detalhes visuais do mapa de calor (escala de cor, ordenação dos eixos).
- N default de simulações e um controle pra aumentar se quiserem mais precisão.
