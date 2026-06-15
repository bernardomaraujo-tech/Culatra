# Pesca Culatra — App Live

Aplicação mobile-first para apoio à decisão de pesca na Ilha da Culatra.

## Conceito

Uma página única, em formato de app para iPhone, com 4 separadores principais:

1. **Meteorologia**
2. **Marés**
3. **Lua**
4. **Pesca**

A zona é selecionada no topo da página:

- **Sul / Ria Formosa**
- **Norte / Atlântico**
- **Ponta da Ilha**

Toda a informação dos separadores é recalculada com base na zona selecionada.

## Funcionalidades

- Atualização automática configurável: 5, 10, 15 ou 30 minutos.
- Atualização manual por botão.
- Dados live via Open-Meteo Weather.
- Dados live via Open-Meteo Marine.
- Marés por WorldTides quando existe chave API.
- Marés estimadas quando não existe chave.
- Ajuste manual de baixa-mar, preia-mar e alturas.
- Cálculo de:
  - score de pesca
  - probabilidade estimada
  - melhores janelas horárias
  - horas a evitar
  - espécies prováveis
  - fatores que influenciam o score
- Gráficos desenhados em canvas, sem dependências externas.
- Funciona em GitHub Pages.

## Estrutura

```text
pesca-culatra-live/
├── index.html
├── manifest.webmanifest
├── assets/
│   ├── culatra-map.png
│   └── icon.svg
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── config.js
└── docs/
    └── FUNCIONAL.md
```

## Testar localmente

```bash
cd pesca-culatra-live
python3 -m http.server 8080
```

Depois abrir:

```text
http://localhost:8080
```

## Publicar no GitHub Pages

1. Criar repositório no GitHub.
2. Fazer upload de todos os ficheiros desta pasta.
3. Ir a **Settings > Pages**.
4. Selecionar **Deploy from branch**.
5. Escolher branch `main` e pasta `/root`.

## Notas importantes

- A meteorologia e o mar funcionam sem chave API através do Open-Meteo.
- Para marés reais, configurar uma chave WorldTides na app em **Fontes**.
- Sem chave de marés, a app usa estimativa local e permite ajuste manual.
- A app prevê condições favoráveis, não garante captura.
