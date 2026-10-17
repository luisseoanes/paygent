# Documentación y política de IA

16 prompts · sesiones S1, S3, S6 · Claude Code (Claude Opus 5.5).

`AI_USAGE.md`, este registro de prompts y la consolidación de lo aprendido en cada sesión en `CLAUDE.md`, `docs/` y `README.md`.

Código afectado: `AI_USAGE.md`, `prompts/`, `CLAUDE.md`, `docs/`, `README.md`.

## 1. S1 · 16/10 11:10

La rubrica pide un archivo @AI_USAGE.md y dan esta estructura de ejemplo:



```text
# AI Usage Disclosure

## Tools Used

* ChatGPT (GPT-4o)

* Claude

## Where and How We Used AI

### 1. Backend – Payment flow (`/src/api/open-payments.ts`)

* Used Claude to scaffold the initial Open Payments flow, creating incoming and outgoing payments, as well as quote creation.

* Reviewed and rewrote error handling ourselves after testing revealed the AI's version didn't handle grants correctly.

### 2. Frontend – Donation platform UI (`/src/components/Donation.tsx`)

* Used Claude to generate all design and frontend pages and components

### 3. Documentation – README setup instructions

* Used ChatGPT to draft the initial README structure.

* Edited by hand to match our actual setup steps and fix inaccurate install commands.

## What We Did Ourselves

* Testing and verification of all AI-suggested code

## Prompt Log

See `/prompts/backend-payments.md` for the full list of prompts used to generate the open payments flow code.
```


Escribela en el nuestro pero en español, no crees la carpeta prompts, referenciala pero yo la hago luego

## 2. S1 · 16/10 11:16

El nombre es paygent para que lo cambies donde sea necesario y enlaza el README de proyecto-....  a docs/context y enlaza el backlog a la ruta correcta en el context

## 3. S1 · 16/10 11:19

Recomiendas ir nutriendo prompts/ en cada iteración o es posible al final recoger todas las sesiones de claude code para nutrirlo a lo ultimo, es por temas de tiempo

## 4. S1 · 16/10 17:05

Voy a cerrar esta sesión y seguir trabajando en una nueva, por ello recibiras algunas instrucciones de documentación con la intención de consolidar los insights y aprendizajes importantes que solo vivan en tu memoria en archivos de documentación para no perder este conocimiento

Para comenzar:

/claude-md-management:revise-claude-md

## 5. S1 · 16/10 17:07

aplica los dos, luego /claude-md-management:claude-md-improver

## 6. S1 · 16/10 17:10

aplica las tres, luego

La siguiente instrucción aplica para todos los .md del repositorio

Después de todo lo que desarrollamos, aprendimos y descubrimos durante esta sesión y adicionalmente demás cosas que puedas investigar, consideras que es necesario realizar alguno de los siguientes trabajos con la documentación (puedes elegir un punto, varios puntos o ninguno, adicionalmente dentro de cada punto puedes sugerir uno o varios .md):

1. Eliminar algún .md de docs/

2. Actualizar algún .md de docs/

3. Segmentar algún .md de docs/ en varios .md

4. Crear un nuevo .md en docs/

5. Sacar cosas de los CLAUDE.md a docs/

6. Separar docs/ en un directorio de docs/ para front, uno para back y uno para la raíz

7. Actualizar el README.md

8. Separar algún o algunos archivo de docs/ en alguna estructura interna de subdirectorios docs/ejemplo/

9. Seprar el CLAUDE.md en dos, uno para el front y otro para la raíz

## 7. S1 · 16/10 17:13

1. No

2. Sí aunque ese backlog no lo estamos siguiendo para nada ya, podríamos hasta eliminarlo

3. Sí

4. Crea los tres

5. Sí

7. Sí

8. Sí

## 8. S1 · 16/10 17:16

sí, haz commit y push sin trailer

## 9. S3 · 16/10 20:18

voy a cerrar esta sesion y mudaré a otra, por ende necesito aprovechar todos los conocimientos e insigths que solo vivan en tu memoria y consideres importante que perduren en la documentación para consolidarlos en los archivos .md, para ello recibiras una serie de instrucciones de documentación, esta es la primera:

/claude-md-management:revise-claude-md

## 10. S3 · 16/10 20:19

aplica los cuatro bloques, luego

/claude-md-management:claude-md-improver

## 11. S3 · 16/10 20:21

aplica los dos cambios

## 12. S3 · 16/10 20:23

la siguiente instrucción aplica para todos los .md del repositorio



```text
Después de todo lo que desarrollamos, aprendimos y descubrimos durante esta sesión y adicionalmente demás cosas que puedas investigar, consideras que es necesario realizar alguno de los siguientes trabajos con la documentación (puedes elegir un punto, varios puntos o ninguno, adicionalmente dentro de cada punto puedes sugerir uno o varios .md):

1. Eliminar algún docs/

2. Actualizar algún docs/

3. Segmentar algún docs/ en varios .md

4. Crear un nuevo docs/

5. Sacar cosas de los CLAUDE.md a docs/

6. Separar docs/ en un directorio de docs/ para front, uno para back y uno para la raíz

7. Actualizar el README.md

8. Separar algún o algunos archivo de docs/ en alguna estructura interna de subdirectorios docs/ejemplo/
```

## 13. S3 · 16/10 20:49

ejecuta todo lo que recomiendas, prompts con datos sustituidos

## 14. S6 · 17/10 09:35

necesito cumplir con la politica de uso de la IA de la competencia, por ende necesito agregar mis prompts a prompts/ como lo pide la rubrica, ya había agregado algunas cosas entonces tendrás que contrastar que ya estaba y que es nuevo, quiero que mires las transcripciones de claude code o los json, correspondientes a este directorio y que nutras prompts/ como lo pide la rubrica en archivos separado por areas de trabajo

## 15. S6 · 17/10 09:40

sí, completa AI_USAGE con S4 y S5, dame las propuestas de completación para leerlas y mirar si las apruebo

## 16. S6 · 17/10 09:44

aplica todo, 1 sí lo hice a mano, 2 no

cuando acabes commit y push
