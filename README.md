# Pesca Culatra

App estática para analisar condições de pesca na Ilha da Culatra por zona e por separador:

- **Meteorologia**: temperatura, vento, rajadas, pressão e conforto.
- **Marés**: baixa-mar, preia-mar, amplitude, corrente estimada, onda, período, direção e temperatura da água.
- **Lua**: fase lunar, luminosidade e janelas de pouca luz.
- **Pesca**: score, probabilidade, melhor hora, horas a evitar, espécies prováveis e alertas.

A app está preparada para ser publicada diretamente no **GitHub Pages**, sem build e sem dependências.

---

## Estrutura

```text
pesca-culatra/
├── index.html
├── manifest.webmanifest
├── assets/
│   ├── icon.svg
│   └── culatra-map.png
├── css/
│   └── styles.css
├── js/
│   ├── config.js
│   ├── data.js
│   ├── services.js
│   ├── score.js
│   └── app.js
└── docs/
    ├── mockup-pesca-culatra.png
    ├── FUNCIONAL.md
    └── ROADMAP.md
```

---

## Como testar localmente

### Opção simples

Abrir o ficheiro `index.html` diretamente no browser.

### Opção recomendada

Na pasta do projeto:

```bash
python3 -m http.server 8080
```

Depois abrir:

```text
http://localhost:8080
```

---

## Como publicar no GitHub Pages

1. Criar um repositório no GitHub, por exemplo: `pesca-culatra`.
2. Enviar todos os ficheiros deste projeto para o repositório.
3. Ir a **Settings > Pages**.
4. Em **Build and deployment**, escolher:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Gravar.
6. Aguardar a publicação do GitHub Pages.

---

## Fontes de dados integradas no MVP

### Open-Meteo Weather

Usado para meteorologia:

- temperatura;
- sensação térmica;
- pressão;
- vento;
- direção do vento;
- rajadas.

Endpoint usado em `js/services.js`:

```text
https://api.open-meteo.com/v1/forecast
```

### Open-Meteo Marine

Usado para dados de mar:

- altura da onda;
- direção da onda;
- período da onda;
- temperatura da água.

Endpoint usado em `js/services.js`:

```text
https://marine-api.open-meteo.com/v1/marine
```

### Marés

O projeto tem suporte preparado para **WorldTides** através de chave API em `js/config.js`.

Sem chave API, a app usa uma estimativa local de fallback para manter o protótipo funcional.

```js
apiKeys: {
  worldTides: '',
  stormglass: ''
}
```

> Nota: para produção, não colocar chaves privadas diretamente em frontend público. Usar um backend, proxy, Supabase Edge Function, Cloudflare Worker ou Netlify Function.

---

## Lógica de score

O score é calculado entre **0 e 100** e muda por zona:

| Zona | Fatores com mais peso |
|---|---|
| Sul / Ria Formosa | maré, vento, corrente e conforto |
| Norte / Atlântico | onda, período, vento e luz |
| Ponta da Ilha | maré, corrente, vento contra maré e segurança |

Os pesos estão definidos em `js/data.js`.

A lógica está implementada em `js/score.js`.

---

## Próximas melhorias recomendadas

1. Validar coordenadas exatas das 3 zonas.
2. Ligar marés reais via API ou backend.
3. Adicionar fonte oficial IPMA / Instituto Hidrográfico como validação.
4. Criar histórico de capturas por zona, hora e espécie.
5. Afinar score com dados reais do utilizador.
6. Criar alertas automáticos para boas janelas de pesca.

---

## Aviso

A app estima **condições favoráveis ou desfavoráveis para pesca**. Não garante captura. Para segurança, confirmar sempre estado do mar, vento, corrente, legislação local e restrições aplicáveis na Ria Formosa.
