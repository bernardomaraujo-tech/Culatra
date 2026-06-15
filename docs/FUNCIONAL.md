# Documento funcional — Pesca Culatra

## 1. Objetivo

Criar uma app simples para apoiar a decisão de quando e onde pescar na Ilha da Culatra, analisando condições por zona e por tipo de informação.

A app não deve prometer capturas. Deve indicar condições mais ou menos favoráveis.

---

## 2. Zonas

| Zona | Enquadramento | Utilização principal |
|---|---|---|
| Sul / Ria Formosa | Zona abrigada, virada para a ria | pesca em canais, zonas calmas e maré controlada |
| Norte / Atlântico | Zona exposta, virada para mar aberto | pesca em praia, com maior dependência de onda e vento |
| Ponta da Ilha | Zona de transição e corrente | potencial elevado, mas exige atenção à segurança |

---

## 3. Separadores da app

### 3.1 Meteorologia

Mostra:

- temperatura;
- vento;
- direção do vento;
- rajadas;
- pressão;
- sensação térmica;
- conforto;
- nota resumida.

### 3.2 Marés

Mostra:

- baixa-mar;
- preia-mar;
- amplitude;
- fase da maré;
- corrente estimada;
- altura da onda;
- período;
- direção da onda;
- temperatura da água;
- melhor fase;
- condições a evitar.

### 3.3 Lua

Mostra:

- fase da lua;
- luminosidade;
- nascer da lua;
- pôr da lua;
- nascer do sol;
- pôr do sol;
- melhor janela com pouca luz.

### 3.4 Pesca

Mostra:

- score de pesca;
- probabilidade;
- melhor hora;
- horas a evitar;
- espécies prováveis;
- recomendação;
- explicação resumida;
- alertas.

---

## 4. Saída da app

| Saída | Descrição |
|---|---|
| Score 0-100 | Indicador rápido das condições |
| Estado | Bom, Moderado ou Atenção |
| Melhor hora | Janela horária recomendada |
| Espécies prováveis | Lista de espécies locais mais prováveis |
| Alertas | Riscos ou condições a evitar |
| Justificação | Explicação curta e compreensível |

---

## 5. Regras principais

- Maré a mexer é mais favorável do que estofo.
- Amanhecer e fim do dia tendem a ser janelas interessantes.
- Vento forte penaliza conforto e segurança.
- No Atlântico, a onda pesa mais do que na Ria.
- Na Ponta, corrente pode ser positiva para pesca, mas negativa para segurança.
- A app separa potencial de pesca de risco.

---

## 6. Fontes previstas

| Tema | Fonte |
|---|---|
| Meteorologia | Open-Meteo Weather |
| Mar | Open-Meteo Marine |
| Marés | WorldTides / Stormglass / Instituto Hidrográfico |
| Validação nacional | IPMA |
| Legislação e restrições | DGRM / ICNF |

---

## 7. Limitações do MVP

- As marés funcionam em fallback se não houver chave API.
- A fase da lua é calculada de forma aproximada.
- As coordenadas das zonas devem ser afinadas com validação local.
- O score ainda não aprende com capturas reais.
- Não existe autenticação nem base de dados.
