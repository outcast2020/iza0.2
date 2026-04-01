# IZA no Cordel 2.0

Aplicacao web de escrita guiada e reflexao textual com identidade visual inspirada em cordel, xilogravura digital e cultura popular brasileira.

A IZA atua como mediadora de escrita: acompanha o participante, devolve perguntas, ajuda a aprofundar o texto e encerra a jornada com sintese, registro e um presente literario.

## Visao geral

O projeto combina:

- interface web em HTML, CSS e JavaScript puro
- fluxo conversacional com diferentes presencas da IZA
- registro da jornada em Google Sheets via Google Apps Script
- fechamento com sintese, palavras-chave e presente literario
- envio opcional de e-mail sem bloquear a experiencia

O foco nao e competicao nem pontuacao. A proposta e levar o participante a pensar melhor o proprio texto.

## Principais recursos

- tres trilhas de escrita
- diferentes presencas da IZA
- visual inspirado no universo Cordel 2.0
- registro em planilha de:
  - dados iniciais
  - trilha escolhida
  - transcript final
  - sintese da jornada
  - palavras-chave
  - presente literario
- envio opcional de e-mail no encerramento
- busca de presente literario em base de poemas
- fallback poetico da IZA quando nao ha associacao forte o bastante
- rubricas e checklist internos para analise de testes, sem exibicao ao participante

## Estrutura do projeto

- `index.html`: shell da aplicacao
- `style.css`: design system e identidade visual
- `app.js`: fluxo do app, trilhas, interface e integracao com o Web App
- `Code.gs`: backend em Google Apps Script
- `rules.js`: regras auxiliares do app
- `logo_cordel_color.png`: identidade visual principal
- `IZA_Poems_Base.xlsx`: base local de apoio

## Como funciona

### Front-end

O participante:

1. informa os dados iniciais
2. escolhe presenca e trilha
3. percorre a jornada textual com a IZA
4. recebe um fechamento com:
   - sintese da jornada
   - palavras-chave
   - presente literario
   - registro completo exportavel

### Back-end

O Apps Script:

- registra dados na planilha de participantes
- busca poemas na base conectada
- ranqueia associacoes lexicais
- devolve um poema, um poema associado ou uma bencao da IZA
- tenta enviar e-mail sem bloquear a experiencia
- envia por e-mail a sintese, o presente literario, o texto sugerido para compartilhar e o registro completo
- nao envia card social em SVG no e-mail por enquanto

## Integracao com Google Apps Script

O arquivo `Code.gs` deve ser publicado como Web App.

O front envia dados para a URL definida em `app.js`.

Quando o front roda dentro do proprio Apps Script, a busca do presente literario prioriza `google.script.run`. Em uso estatico, o app recorre ao endpoint publicado do Web App.

### Planilhas

O projeto usa duas bases:

- planilha de registro dos participantes
- planilha da base de poemas

O Apps Script aceita configuracao por `Script Properties`:

- `IZA_RECORDS_SPREADSHEET_ID`
- `IZA_RECORDS_SHEET_NAME`
- `IZA_POEMS_SPREADSHEET_ID`
- `IZA_POEMS_SHEET_NAME`

Se essas propriedades nao forem definidas, o script usa os fallbacks configurados no proprio `Code.gs`.

## Base de poemas

Para melhorar a busca do presente literario, a aba `POEMS` pode ser indexada com colunas auxiliares:

- `NORM_TITLE`
- `NORM_CONTENT`
- `NOUNS`
- `VERBS`
- `ADJECTIVES`
- `BIGRAMS`
- `ALL_TOKENS`

Apos atualizar a base, execute manualmente no Apps Script:

```javascript
syncPoemsAnnotations_()
```

Isso recalcula a indexacao usada pelo motor de associacao poetica.

## Como rodar localmente

Como o front e estatico, voce pode:

1. abrir `index.html` no navegador
2. ou servir a pasta com um servidor estatico simples

Se quiser testar o registro e o presente literario, o Web App do Apps Script precisa estar publicado e acessivel.

Sempre que `Code.gs` for alterado, publique uma nova versao do Web App para colocar as mudancas em producao.

## Fluxo de encerramento

Ao final de cada trilha, o app tenta entregar o presente em tres niveis:

1. `poema direto`
2. `poema associado`
3. `bencao de encerramento da IZA`

Isso evita que o fechamento fique seco quando nao ha coincidencia forte o suficiente na base.

O transcript final visivel ao participante inclui a sintese da jornada, as palavras-chave, o presente literario e o registro completo exportavel. A rubrica de teste e a definicao de pronto ficam restritas ao uso interno.

## Estado atual

O projeto ja inclui:

- redesign visual inspirado em Cordel 2.0
- microcopy revisada
- fechamento enriquecido
- registro em planilha
- exportacao de `.txt`
- associacao literaria com fallback poetico
- envio de e-mail com fechamento textual, sem depender de anexo visual

## Proximos aprimoramentos possiveis

- melhorar a associacao entre texto do participante e poemas da base
- refinar a explicacao do vinculo entre jornada e presente literario
- fortalecer a curadoria da base poetica
- lapidar ainda mais o tom das bencaos por trilha e presenca
- ampliar testes com dialogos reais

## Licenca

Este repositorio inclui um arquivo `LICENSE`.
