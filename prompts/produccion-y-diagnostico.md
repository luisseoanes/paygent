# Diagnóstico en producción, integración y entrega

19 prompts · sesión S7 (Luis) · Claude Code (Claude Opus 5.5).

Por qué a un beneficiario no le llegaban los SMS y no se le cobraba un vale, leyendo los logs de Railway, la base de
producción y la nube de SMS Gateway; arreglos en producción con aprobación explícita; merge de
`feat/puntored-simulado` a `main`; prueba de humo contra producción sin reset; arreglo del celular que firmaba vales
con un certificado de una rama borrada; revisión de la entrega frente a los criterios del jurado.

Código afectado: `src/web/src/features/billetera/hooks/use-refrescar-dispositivo.ts` (y su test),
`src/api/src/merchants/routes.ts`, `src/web/src/app/routes/tendero.tsx`, `src/web/src/types/api.ts`,
`docs/api/endpoints.md`. En producción (Railway): perfiles SMS y titulares de dos ramas de la base.

Horas aproximadas, sacadas de los logs de Railway.

## 1. S7 · 17/10 ≈00:08

analiza, pedro se registro, yo cree mi cuenta con mi propia wallet, ya lo puse como beneficiario, dime porque no le llegan mensajes, le intento poner activar con sms pero dice que ese numero ya esta en otra rama cuando el solo enlazo su cuenta

## 2. S7 · 17/10 ≈00:12

conectate a mi railway cli alli dice

## 3. S7 · 17/10 ≈00:15

haz la parte rapida desde aca rapido

## 4. S7 · 17/10 ≈00:16

yo lo apruebo cuando lo pidas

## 5. S7 · 17/10 ≈00:17

do it

## 6. S7 · 17/10 ≈00:24

revisa, le agregue el numero de pedro y le active sms pero no le esta llegando se le demora mucho

## 7. S7 · 17/10 ≈00:32

revisa los logs, no esta respindiendo mensajes

## 8. S7 · 17/10 ≈01:25

haz pull, y push mete lo de la rama al main, con tal de que con eso ya estaria terminado todo y comienzo a grabar videos

## 9. S7 · 17/10 ≈01:32

haz pull

## 10. S7 · 17/10 ≈01:33

Entocnes ya funciona el vale?, comprueba que funciona todo en produccion, el vale, los pagos el agente todo

## 11. S7 · 17/10 ≈01:36

ahorita cree una cuenta, […], puse de beneficario a pedro, hice un pago de vale por 5000 pero al leer el qr salio como si hubieran sido 3900 y rechazo el vale cuando volvio el interne

## 12. S7 · 17/10 ≈01:48

monta este arreglo

## 13. S7 · 17/10 ≈01:52

haz eso tu en railway

## 14. S7 · 17/10 ≈01:55

do it

## 15. S7 · 17/10 ≈02:00

Que mas tenemos ue verificar en general en todo, para estar 100% seguros ue todo funciona?

## 16. S7 · 17/10 ≈02:05

dame una descripcion del proyecto que encapsule todo, desde e mandato a pagos sin señal ni wifi

## 17. S7 · 17/10 ≈02:07

es para github

## 18. S7 · 17/10 ≈02:10 (enviado 2 veces con el mismo texto pegado)

Primer envío: «segun esos criterios». Segundo: «te pregunto, cumplimos con todo? con al rubrica dime como lo ves».

```text
Hackathon navigation

Hackathons

2026 Open Payment Hackathon
EN
English
ES
Spanish
Home
Hackathon
Submission & Judging
Submission & Judging
Preparing your Submission
Submissions should include:
Presentation slides
Link to demo
Link to public GitHub repo
 

Optional:

Architecture diagrams
Mockups
Technical documentation
Videos
Your presentation should explain:
The challenge
The user
The solution
How Open Payments was used
Key learnings
Your demo should show:
A working demonstration and recording of the payment flow, clearly showing:

Payment request
Authorization
Payment execution
Successful completion
Submission & Review Process
Code, demo, and presentation submission closes at 11:00. From that point, reviews run in parallel across two tracks so that code, demos, and presentations are all checked before Round 1 judging begins at 12:00. 

Step by step
Step 1 - Code, demo, and presentation submission deadline @11:00am.
All teams push their final code into their GitHub public repository. No further code changes after this point. Demos and presentations are uploaded to your folder on the Google Drive. 

Follow these steps to submit your project.

Make your GitHub repository public - Your code needs to be visible to the reviewers, so make sure your repository’s visibility is set to Public before you submit.
Share your repository link - You will be given a Google form link on the hackathon Slack channel, where you can upload your public GitHub repository link. This is how the reviewers will find and review your project.
Make sure your repository contains all your code - The repository must include everything you wrote during the hackathon - all code, no partial uploads or code left only on someone’s local machine. Make sure you push all your branches to main.
Make sure your submission contains the requirements from AI guidelines for hackathons - The ‘AI guidelines for hackathons’ require some extra files and folders to be submitted, disclosing AI usage.
Demo videos and presentations should also be submitted by 11am. These should be uploded to a Google Drive. The link will be provided to you on the day and there’ll be a dedicated folder for each team
 
Step 2 - Technical mentors begin code review (11:00 - 12:00)
Technical mentors move to the mentors’ room, so they can discuss if there are questions. They review each team’s repository directly.

Step 3 - Presentation practice (11:00 - 12:00)
In parallel to the technical review, participants will be able to move to the auditorium to practice their presentations. Refreshments will be served. Round 1 judging will happen in hack rooms and start at 12:00pm sharp.
 

Judging Criteria
Criteria	What we’re looking for
Problem Definition	Is the challenge clear and meaningful?
Use of Open Payments	Does the project demonstrate a working payment flow?
User Experience	Does the solution create value for users?
Technical Quality	Does the prototype work reliably?
Presentation	Can the team clearly explain what they’ve built and why it matters?
Inclusion	How does this solution make payments easier, more accessible, or more inclusive for underserved users?
Innovation	How creative and original is this solution’s approach to payments?
Impact	What difference could this solution make for users or communities, and how clearly is that explained?
How Judging Works
Round 1
Every team presents to a judging panel. The time limit for the pitch (including demo) is 5 minutes. This takes place in the hack rooms on Saturday at 12:00, after all participants have submitted their final presentations and code. There will be 4 rooms, each with a minimum of 2 judges. Teams present to the judges in their assigned room. Once all teams in a room have presented, the judges deliberate and select the teams to progress to Round 2, based on each team’s cumulative score against the judging criteria.

Round 2
The 12 teams progressing to Round 2 are announced in the auditorium and immediately present their solutions to a new judging panel, which includes representatives from each award category. The time limit for the pitch in Round 2 (including demo) is also 5 minutes. All participants also vote for their favorite solution for the This Week in Fintech Community Award. Once all Round 2 presentations are complete, the judging panel convenes to select the overall award winners. All participants are then invited back into the auditorium for the winners’ announcement.

Stay up to date
Sign up for our newsletter and keep up to date with our news and events

Contact us
Have a question? We have answers. Send us a message, and we will get back to you.

Social Links
Hackathons
2026 Open Payment Hackathon
Content on this website and Interledger Foundation publications are licensed under CC BY 4.0, unless otherwise noted. Interledger technologies and software are licensed under the Apache License 2.0, unless otherwise noted. Interledger Protocol® and ILP® are registered trademarks of the Interledger Foundation.
```

## 19. S7 · 17/10 ≈02:20

haz pull, y monta en lo de ai usage lo de mi chat, para que este al dia
