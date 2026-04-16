# IZA no Cordel 0.2

Aplicação de escrita guiada em Cordel 2.0, com frontend estático em HTML/CSS/JavaScript puro e backend em Google Apps Script. A versão local `iza0.2-main` já combina validação de check-in por e-mail, definição de presença conversacional, trilhas de escrita, síntese final e busca de presente literário em base poética.

## Resumo técnico

- Frontend sem build step: `index.html`, `style.css`, `app.js`, `rules.js`.
- Backend publicado como Web App em `Code.gs`.
- Estado salvo em `localStorage` com a chave `izaState`.
- Registro de jornada dividido em quatro momentos lógicos:
  - `init`
  - `choice`
  - `final`
  - `final_gift`
- Integração de check-in via JSONP (`action=checkin_lookup`).
- Integração de presente literário via `google.script.run` quando o app roda dentro do Apps Script, com fallback para JSONP/HTTP quando roda como página estática.

## Estrutura do projeto

- `index.html`: shell da experiência.
- `style.css`: identidade visual e componentes.
- `app.js`: máquina de estados da jornada, UI, validações, resumo final e chamadas ao backend.
- `rules.js`: base de regras conversacionais, marcadores socráticos e overrides por presença/trilha.
- `Code.gs`: persistência, lookup de check-in, lookup de presente literário e e-mail final.
- `ION_Plato.csv` / `ION_Plato_ptBR.csv`: insumos textuais de apoio.
- `IZA_Poems_Base.xlsx`: base local de referência para a planilha poética.

## Fluxo da experiência

1. A pessoa informa o e-mail e precisa validar identidade pelo endpoint de check-in.
2. O backend devolve `name`, `municipio`, `estado`, `origem`, `teacherGroup`, `participantId` e `checkinUserId`.
3. A pessoa escolhe uma presença fixa da IZA ou responde um teste de 5 perguntas para gerar uma presença híbrida.
4. A pessoa escolhe uma trilha:
   - `iniciante`: 4 passos.
   - `intermediaria`: 7 passos.
   - `inspirada`: conversa aberta com mínimo de 7 rodadas antes do encerramento.
5. Cada resposta passa por validação de passo e pelo motor de regras em `rules.js`.
6. No fechamento, o app gera:
   - síntese da jornada;
   - palavras-chave;
   - transcript final;
   - presente literário;
   - texto final em bloco próprio, quando houver.
7. O backend registra a jornada e pode enviar o fechamento por e-mail.

## Frontend em detalhe

### Constantes importantes

- `WEBAPP_URL`: URL do Web App publicado.
- `APP_VARIANT`: `iza0.2`.
- `MIN_INSPIRED_ROUNDS`: `7`.
- `GIFT_LOOKUP_TIMEOUT_MS`: `45000`.

### Estado local

O objeto `state` em `app.js` concentra:

- identidade resolvida pelo check-in;
- presença atual (`A`, `B`, `C`, `D` ou `H`);
- `presenceMix` quando a presença é híbrida;
- trilha ativa e índice do passo;
- turns completos da conversa;
- resumo final, checklist e rubrica;
- flags de envio e registro;
- histórico de telas para navegação de revisão.

### Presenças da IZA

O frontend trabalha com quatro presenças fixas e uma combinação híbrida:

- `A`: discreta.
- `B`: calorosa.
- `C`: firme.
- `D`: minimalista.
- `H`: híbrida, calculada pelo teste de 5 perguntas.

Cada presença altera:

- abertura de resposta;
- espelhamento;
- fechamento;
- peso das regras;
- tom de perguntas e intervenções.

### Trilhas

- `iniciante`: núcleo -> centro -> tipo de centro -> atrito -> cena -> frase final.
- `intermediaria`: tema -> centro -> tipo de centro -> atrito -> concreto -> contraste -> síntese -> forma final.
- `inspirada`: abertura -> centro -> tipo de centro -> loop.

Na trilha `inspirada`, o comando de encerramento só é aceito depois de 7 rodadas.

### Motor de regras

`rules.js` expõe:

- `window.IZA_RULES`
- `window.getIZARulesFor(presenceKey, presenceMix)`

O arquivo inclui:

- regras socráticas;
- memória curta por regra;
- marcadores temáticos inspirados em `ION`;
- pesos por presença;
- pesos por trilha/etapa.

### Persistência e UX

- Salvamento automático em `localStorage`.
- Retomada de sessão interrompida.
- Histórico de telas com navegação apenas para revisão, sem reabrir edição do texto.
- Exportação do transcript final em `.txt`.

## Backend em detalhe

### Endpoints

`Code.gs` expõe:

- `GET ?action=gift`
- `GET ?action=checkin_lookup`
- `POST` com payload JSON para `init`, `choice`, `final` e `final_gift`
- `lookupLiteraryGift(payload)` para uso por `google.script.run`

### Script Properties aceitas

- `IZA_RECORDS_SPREADSHEET_ID`
- `IZA_RECORDS_SHEET_NAME`
- `IZA_CHECKIN_SPREADSHEET_ID`
- `IZA_CHECKIN_SHEET_NAME`
- `IZA_POEMS_SPREADSHEET_ID`
- `IZA_POEMS_SHEET_NAME`
- `IZA_DEBUG_CHECKIN_EMAIL`

Se essas propriedades não forem definidas, o script usa os fallbacks hardcoded no próprio `Code.gs`.

### Registro principal

A linha principal de registro usa cabeçalhos como:

- `DATA/HORA`
- `APP_VARIANT`
- `SESSION_ID`
- `PARTICIPANT_ID`
- `CHECKIN_USER_ID`
- `CHECKIN_MATCH_STATUS`
- `CHECKIN_MATCH_METHOD`
- `ESCRITOR/A`
- `EMAIL`
- `MUNICIPIO`
- `ESTADO`
- `ORIGEM`
- `TEACHER_GROUP`
- `TRILHA`
- `PERSONALIDADE DO BOT`
- `REGISTRO DOS ESCRITOS`
- `SINTESE DA JORNADA`
- `PALAVRAS-CHAVE`
- `PRESENTE LITERARIO`
- `CREDITO DO PRESENTE`
- `LOG FECHAMENTO`

### Check-in

O lookup de check-in tenta casar registros por:

1. e-mail
2. nome + turma/coorte
3. nome + municipio

O retorno inclui `participantId` estável, gerado a partir do check-in ou de identidade normalizada.

### Presente literário

O motor poético:

- normaliza keywords e resumo da jornada;
- divide a base de poemas em 5 shards rotativos;
- indexa e pontua poemas por interseção lexical e temas;
- escolhe excerto;
- cai para um fallback poético quando não acha correspondência suficiente.

Colunas auxiliares esperadas na aba `POEMS`:

- `NORM_TITLE`
- `NORM_CONTENT`
- `NOUNS`
- `VERBS`
- `ADJECTIVES`
- `BIGRAMS`
- `ALL_TOKENS`
- `THEMES`

Para recalcular essas colunas:

```javascript
syncPoemsAnnotations_()
```

### E-mail final

No estágio `final_gift`, o backend pode enviar:

- síntese da jornada;
- palavras-chave;
- presente literário;
- crédito do presente;
- sugestão de compartilhamento;
- transcript completo.

O envio usa `GmailApp.sendEmail`. O fluxo não trava a experiência se o envio falhar.

## Deploy e operação

1. Atualize `Code.gs` no projeto Apps Script.
2. Publique uma nova versão do Web App.
3. Atualize `WEBAPP_URL` em `app.js` se a URL mudar.
4. Garanta acesso de leitura às planilhas de check-in e poemas.
5. Rode `syncPoemsAnnotations_()` quando a base poética mudar de estrutura ou conteúdo.

## Observações

- Apesar do nome `0.2`, esta pasta local já incorpora lookup de check-in, resumo final estruturado e presente literário com fallback.
- O app foi desenhado para rodar sem bundler, sem framework e sem dependência de backend fora do ecossistema Google.
