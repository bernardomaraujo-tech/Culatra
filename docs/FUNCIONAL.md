# Documento funcional — Culatra Hoje

## Objetivo

Criar uma página/aplicação interativa para apoiar a decisão de ida à Ilha da Culatra, considerando praia, meteorologia, marés, lua e pesca.

A aplicação distingue três zonas:

- Sul / Atlântico
- Norte / Ria Formosa
- Ponta da Ilha

## Separadores

### 1. Meteorologia

Deve apresentar:

- temperatura;
- sensação térmica;
- vento;
- direção do vento;
- rajadas;
- humidade;
- pressão;
- probabilidade de chuva;
- quadro horário com céu, temperatura, vento, direção do vento, ondulação e período da vaga;
- gráfico de temperatura e vento;
- leitura funcional para praia, conforto, abrigo, exposição ao vento e risco de areia.

### 2. Marés

Deve apresentar:

- fase da maré;
- próxima baixa-mar e próxima preia-mar;
- amplitude;
- força da corrente;
- ondulação;
- período;
- direção da ondulação;
- temperatura da água;
- gráfico de maré e ondulação;
- próximas marés.

### 3. Lua

Deve apresentar:

- fase da lua;
- luminosidade;
- idade lunar;
- nascer do sol;
- pôr do sol;
- janelas de pouca luz;
- períodos solunares;
- calendário solunar e de marés.

### 4. Pesca

Deve apresentar:

- pontuação de pesca;
- probabilidade estimada;
- gráfico comparando pontuação de pesca e maré;
- atividade solunar;
- previsão de hoje + 7 dias;
- espécies prováveis por zona;
- recomendação prática.

## Lógica de pontuação

A pontuação é calculada por zona com pesos diferentes.

### Norte / Ria Formosa

- Maré: 35%
- Mar: 10%
- Vento: 20%
- Hora / luz: 15%
- Água: 10%
- Lua: 5%
- Pressão: 5%

### Sul / Atlântico

- Maré: 20%
- Mar: 30%
- Vento: 20%
- Hora / luz: 15%
- Água: 8%
- Lua: 4%
- Pressão: 3%

### Ponta da Ilha

- Maré: 30%
- Mar: 20%
- Vento: 20%
- Hora / luz: 15%
- Água: 8%
- Lua: 4%
- Pressão: 3%

## Fontes previstas

- Open-Meteo Weather
- Open-Meteo Marine
- WorldTides, opcional
- Instituto Hidrográfico, para validação oficial de marés
- IPMA, para validação meteorológica e marítima
