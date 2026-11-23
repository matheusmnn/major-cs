# Incremento: dados automáticos da HLTV (força + forma + H2H)

## Intenção
Preencher a força dos times automaticamente a partir da HLTV, somando dois sinais:
forma recente e confronto direto (H2H) entre os times do major. Hoje a força é
digitada na mão; este incremento a deriva de dados reais.

## A restrição que molda tudo
Uma página `file://` não consegue puxar da HLTV (CORS + bloqueio de bot) nem
sequer `fetch` um `data.json` vizinho (CORS de file://). Logo:
- A coleta roda **fora da página**, uma vez, antes do campeonato (passo de preparação).
- O resultado é **injetado no HTML** pelo build (vira uma variável global), não lido
  por fetch. Assim o arquivo único segue abrindo de `file://`.

## Fluxo
1. `node fetch.js` — usa o pacote `hltv` (não-oficial) e escreve `data.json`.
2. `node build.js` — injeta `data.json` no `dist/confrontos.html` como `window.__DATA__`.
3. Abrir `dist/confrontos.html`. (Um `npm run build` encadeia os dois.)

## O que `fetch.js` coleta (por time do major)
- **Força-base = pontos do ranking mundial HLTV** (número estável que já reflete forma
  recente). *(minha escolha; alternativa seria % de vitória nos últimos N — menos robusto)*
- **H2H** = resultados entre os 16 times do major numa janela recente (default: 12 meses),
  como contagem de mapas/partidas vencidas de cada lado.
- Escreve `data.json`: `{ teams:[{name, hltvId, force}], h2h:{ "a-b": {winsA, winsB} } }`.

## Como os dois viram probabilidade de jogo
- Base: `mapWinProb(forçaA, forçaB, upset)` (já existe).
- Ajuste H2H, só onde houver histórico:
  `P = (1−w)·P_base + w·(winsA/(winsA+winsB))`, com `w = n/(n+k)` crescendo com o nº
  de jogos diretos `n` (default `k=4`: com 4 confrontos, peso 50%). Sem H2H → só a base.
- Vira uma opção no motor (`runMonteCarlo` aceita `h2h` + `k`), ligável/desligável na UI.

## Resolução de times (passo prático)
Nomes são ambíguos; o script resolve cada time do major para um **hltvId** (por busca de
nome, com uma tabela de confirmação editável). Erro de resolução = força errada, então
a tabela de IDs fica visível pra você conferir.

## Não-objetivos
- Coleta ao vivo durante as partidas (é passo de preparação).
- Garantir que a HLTV nunca bloqueie o scraper (é não-oficial; se cair, volta pro manual).
- Ranking/força de jogadores individuais.

## Riscos
- `hltv` é não-oficial: pode quebrar ou ser bloqueado (Cloudflare). O `data.json` isola a
  página disso — em tempo de uso nada depende do scraper.
- Janela de forma/H2H é um parâmetro; valores default podem precisar de ajuste.

## Decisões que são suas
- Força-base = pontos do ranking HLTV (recomendado) ou % de vitórias recentes?
- Janela de H2H (default 12 meses) e `k` do peso (default 4) — ok?
