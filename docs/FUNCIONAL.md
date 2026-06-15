# Documento funcional — Culatra Hoje

## Objetivo

Criar uma página/app interativa para apoiar a decisão de ida à Ilha da Culatra, incluindo praia, meteorologia, marés, lua e pesca, considerando a diferença entre:

- Sul / Ria Formosa
- Norte / Atlântico
- Ponta da Ilha

## Separadores

### 1. Meteorologia

Mostra:

- temperatura
- sensação térmica
- vento
- direção do vento
- rajadas
- pressão atmosférica
- humidade
- probabilidade de chuva
- gráfico de temperatura e vento
- leitura funcional para pesca

### 2. Marés

Mostra:

- fase da maré
- altura atual estimada
- baixa-mar
- preia-mar
- amplitude
- força da corrente
- onda
- período
- direção da ondulação
- temperatura da água
- gráfico de maré e ondulação
- próximas marés
- melhor fase e fase a evitar

### 3. Lua

Mostra:

- fase da lua
- luminosidade
- idade lunar
- nascer do sol
- pôr do sol
- janelas de pouca luz
- leitura funcional da influência lunar

### 4. Pesca

Mostra:

- score de pesca
- probabilidade estimada
- melhores janelas horárias
- horas a evitar
- espécies prováveis
- peso dos fatores
- recomendação operacional

## Lógica de score

O score é calculado por zona com pesos diferentes.

### Sul / Ria Formosa

- Maré: 35%
- Mar: 10%
- Vento: 20%
- Hora / luz: 15%
- Água: 10%
- Lua: 5%
- Pressão: 5%

### Norte / Atlântico

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
- WorldTides opcional
- IPMA para validação operacional
- Instituto Hidrográfico para validação oficial de marés
- DGRM e ICNF para regras e enquadramento
