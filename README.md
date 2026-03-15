# IZA no Cordel 2.0

Aplicação web de escrita guiada e reflexão textual com identidade visual inspirada em cordel, xilogravura digital e cultura popular brasileira.

A IZA atua como uma mediadora de escrita: acompanha o participante, devolve perguntas, ajuda a aprofundar o texto e encerra a jornada com síntese, registro e um presente literário.

## Visão geral

O projeto combina:

- interface web em HTML, CSS e JavaScript puro
- fluxo conversacional com diferentes presenças da IZA
- registro da jornada em Google Sheets via Google Apps Script
- fechamento enriquecido com síntese, palavras-chave e presente literário

O foco não é competição nem pontuação. A proposta é levar o participante a pensar melhor o próprio texto.

## Principais recursos

- três trilhas de escrita
- diferentes personalidades da IZA
- visual inspirado no universo Cordel 2.0
- registro em planilha de:
  - dados iniciais
  - trilha escolhida
  - transcript final
  - síntese da jornada
  - palavras-chave
  - presente literário
- envio opcional de e-mail no encerramento
- busca de presente literário em base de poemas
- fallback poético da IZA quando não há associação forte o bastante

## Estrutura do projeto

- [index.html](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/index.html): shell da aplicação
- [style.css](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/style.css): design system e identidade visual
- [app.js](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/app.js): fluxo do app, trilhas, interface e integração com o web app
- [Code.gs](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/Code.gs): backend em Google Apps Script
- [rules.js](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/rules.js): regras auxiliares do app
- [logo_cordel_color.png](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/logo_cordel_color.png): identidade visual principal
- [IZA_Poems_Base.xlsx](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/IZA_Poems_Base.xlsx): base local de apoio

## Como funciona

### Front-end

O participante:

1. informa os dados iniciais
2. escolhe presença e trilha
3. percorre a jornada textual com a IZA
4. recebe um fechamento com:
   - síntese da jornada
   - palavras-chave
   - presente literário
   - registro completo exportável

### Back-end

O Apps Script:

- registra dados na planilha de participantes
- busca poemas na base conectada
- ranqueia associações lexicais
- devolve um poema, um poema associado ou uma bênção da IZA
- tenta enviar e-mail sem bloquear a experiência

## Integração com Google Apps Script

O arquivo [Code.gs](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/Code.gs) deve ser publicado como Web App.

O front envia dados para a URL definida em [app.js](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/app.js).

### Planilhas

O projeto usa duas bases:

- planilha de registro dos participantes
- planilha da base de poemas

O Apps Script aceita configuração por `Script Properties`:

- `IZA_RECORDS_SPREADSHEET_ID`
- `IZA_RECORDS_SHEET_NAME`
- `IZA_POEMS_SPREADSHEET_ID`
- `IZA_POEMS_SHEET_NAME`

Se essas propriedades não forem definidas, o script usa os fallbacks configurados no próprio [Code.gs](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/Code.gs).

## Base de poemas

Para melhorar a busca do presente literário, a aba `POEMS` pode ser indexada com colunas auxiliares:

- `NORM_TITLE`
- `NORM_CONTENT`
- `NOUNS`
- `VERBS`
- `ADJECTIVES`
- `BIGRAMS`
- `ALL_TOKENS`

Após atualizar a base, execute manualmente no Apps Script:

```javascript
syncPoemsAnnotations_()
```

Isso recalcula a indexação usada pelo motor de associação poética.

## Como rodar localmente

Como o front é estático, você pode:

1. abrir [index.html](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/index.html) no navegador
2. ou servir a pasta com um servidor estático simples

Se quiser testar o registro e o presente literário, o Web App do Apps Script precisa estar publicado e acessível.

## Fluxo de encerramento

Ao final de cada trilha, o app tenta entregar o presente em três níveis:

1. `poema direto`
2. `poema associado`
3. `bênção de encerramento da IZA`

Isso evita que o fechamento fique seco quando não há coincidência forte o suficiente na base.

## Estado atual

O projeto já inclui:

- redesign visual inspirado em Cordel 2.0
- microcopy revisada
- fechamento enriquecido
- registro em planilha
- exportação de `.txt`
- associação literária com fallback poético

## Próximos aprimoramentos possíveis

- melhorar a associação entre texto do participante e poemas da base
- refinar a explicação do vínculo entre jornada e presente literário
- fortalecer a curadoria da base poética
- lapidar ainda mais o tom das bênçãos por trilha e presença
- ampliar testes com diálogos reais

## Licença

Este repositório inclui um arquivo [LICENSE](/C:/Users/Carlos/Documents/ai%20BOT/Lab/IZA/iza/0.3/iza_app/iza0.2-main/LICENSE).
