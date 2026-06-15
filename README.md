# Pesca Culatra

Aplicação mobile-first para apoio à decisão de pesca na Ilha da Culatra.

## Separadores principais

- Meteorologia
- Marés
- Lua
- Pesca

## Zonas analisadas

- Sul / Ria Formosa
- Norte / Atlântico
- Ponta da Ilha

## Fontes de dados

- Open-Meteo Weather para meteorologia
- Open-Meteo Marine para estado do mar
- WorldTides opcional para marés reais
- Estimativa local de maré quando não existe chave API

## Atualização

A aplicação atualiza automaticamente no intervalo definido nas fontes e permite atualização manual.

## Correção desta versão

Esta versão repõe integralmente o ficheiro `css/styles.css`, que estava corrompido com conteúdo que não era CSS. A falha fazia com que a página aparecesse sem formatação no iPhone/Safari.


## Atualização meteorologia

- Adicionada leitura de **tempo de praia** com score próprio.
- Adicionada legenda no gráfico das próximas 24 horas.
- Os cartões horários agora mostram **hora, temperatura, vento e direção do vento**.
- A lista horária é horizontal e deve ser deslizada no telemóvel para ver mais horas.
- Adicionada secção dedicada à **direção do vento ao longo do dia**.

## Atualização 15/06 - Meteorologia

A secção Meteorologia foi ajustada para:

- mostrar apenas a hora atual e as próximas horas;
- evitar cartões com horas já passadas no início da lista;
- permitir navegação horizontal com gesto e botões laterais;
- mostrar legenda do gráfico de temperatura e vento;
- mostrar direção do vento com texto e seta visual;
- orientar a leitura para apoio à decisão de praia, conforto e exposição ao vento.


## Atualização direção do vento

- Direções do vento apresentadas em siglas portuguesas: N, NE, E, SE, S, SO, O e NO.
- As setas respeitam a direção de origem do vento: Norte aponta para cima e Sul aponta para baixo.


## Critério praia

A classificação de praia usa vento mais exigente do que a meteorologia geral:

- 0-8 km/h: excelente
- 9-14 km/h: bom / brisa
- 15-22 km/h: moderado
- 23-30 km/h: mau, provável areia a levantar
- >30 km/h: evitar

As rajadas também penalizam: acima de 23 km/h passa a moderado, acima de 29 km/h passa a mau e acima de 35 km/h passa a evitar.

## Zonas

- Sul / Atlântico
- Norte / Ria Formosa
- Ponta da Ilha

## Atualização — lógica de espécies

A secção **Pesca** foi atualizada para calcular as espécies prováveis por zona, mês do ano, fase da maré, luz, vento e estado do mar.

Regras principais:

- **Norte / Ria Formosa** usa espécies e lógica interior da Ria: robalo, dourada, sargo, linguado, choco, lula e polvo.
- **Sul / Atlântico** usa espécies e lógica de costa: robalo, dourada, sargo, corvina, linguado, lula e polvo.
- **Ponta da Ilha** usa a lógica da costa, por ser zona de transição e influência oceânica.
- Cada espécie mostra agora probabilidade, mês forte/médio/fraco, fase de maré e explicação curta do porquê.
