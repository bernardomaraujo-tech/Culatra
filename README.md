# Culatra Hoje

Aplicação mobile-first para apoio à decisão na Ilha da Culatra, com foco em meteorologia, marés, lua, praia e pesca.

## Separadores principais

- Meteorologia
- Marés
- Lua
- Pesca

## Zonas analisadas

- Sul / Atlântico
- Norte / Ria Formosa
- Ponta da Ilha

## Fontes de dados

- Open-Meteo Weather para meteorologia
- Open-Meteo Marine para estado do mar
- WorldTides, opcional, para marés reais
- Estimativa local de maré quando não existe chave API

## Atualização

A aplicação atualiza automaticamente de acordo com o intervalo configurado e também permite atualização manual.

## Meteorologia

A secção Meteorologia inclui:

- leitura de tempo de praia com pontuação própria;
- quadro horário com céu, temperatura, vento, direção do vento, ondulação e período da vaga;
- gráfico com legenda para temperatura e vento;
- direção do vento com siglas portuguesas e seta visual;
- leitura orientada para praia, conforto, abrigo, exposição ao vento e risco de areia.

## Direção do vento

- Direções apresentadas em siglas portuguesas: N, NE, E, SE, S, SO, O e NO.
- As setas respeitam a direção de origem do vento: Norte aponta para cima e Sul aponta para baixo.

## Critério de praia

A classificação de praia usa critérios mais exigentes do que a meteorologia geral:

- 0–8 km/h: excelente
- 9–14 km/h: bom / brisa
- 15–22 km/h: moderado
- 23–30 km/h: mau, com provável levantamento de areia
- >30 km/h: evitar

## Pesca

A secção Pesca usa:

- pontuação de pesca;
- probabilidade estimada;
- maré, vento, mar, lua, luz e períodos solunares;
- espécies prováveis por zona;
- previsão de hoje + 7 dias com lua, sol, marés, coeficiente e atividade média.

## Playlist

A secção Pesca inclui uma playlist Spotify incorporada no final da página.


## Coeficiente de maré

O coeficiente apresentado é um índice local estimado. Combina o marnel diário com a referência local da Ria Formosa/Culatra para marés mortas e vivas e aplica uma correção astronómica pela fase lunar. Quando existir fonte real de marés, as alturas reais têm prioridade sobre a estimativa.

- Meteorologia inclui resumo horário e previsão diária dos próximos 7 dias para apoio à decisão de praia.


## Ajustes recentes

- Resumo superior de pesca removido do topo.
- Separador Lua simplificado, sem tabelas de pesca/solunar.
