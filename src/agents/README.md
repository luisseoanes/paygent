# src/agents/

Servicio FastAPI con los cuatro agentes. `uv run python main.py` (o `pnpm dev` desde la raíz). Docs interactivas en `/docs`.

| Módulo | Qué hace | Dónde tocar |
|---|---|---|
| `assistant/` | Conversa por SMS. `llm.py` = Claude con tool use; `rules.py` = respaldo determinista; `tools.py` = las únicas acciones (todas pasan por `/pay`) | Prompt en `llm.py`, textos en `replies.py` |
| `inventory/` | Búsqueda con sinónimos + rapidfuzz; cobra $0.01 por consulta | `catalog.csv`, `merchants.csv`, `search.py` |
| `intent/` | Frase de Juan → árbol de mandatos validado | `compiler.py` |
| `guardian/` | Reglas deterministas de riesgo y ajuste del tope offline | `rules.py` |

## Reglas que no se rompen

- El **PIN nunca llega al LLM**: `assistant/router.py` lo intercepta antes.
- El LLM no mueve dinero: solo llama herramientas, y `/pay` decide.
- Si el LLM falla o tarda más de `LLM_TIMEOUT_S`, responde `rules.py`.
- El Guardián decide con reglas; el texto es plantilla (TODO GRD-04: redactarlo con LLM).

## Dataset sintético (INV-01)

`catalog.csv` y `merchants.csv` se escribieron a mano: medicamentos comunes y productos de mercado con precios aproximados en COP (2026), 6 comercios alrededor de un punto de un municipio de Antioquia (lat 6.0, lng -75.43) y sinónimos coloquiales ("pastilla de la presión" → losartán). Varios comercios comparten la wallet del Test Wallet de su tipo (`wallet_env`): si quieren más realismo, creen más wallets y añádanlas al `.env`.

## Tests

`uv run pytest -q`. `tests/test_inventory.py` tiene las consultas de prueba de INV-02 (amplíenlas hasta 20+); `tests/test_assistant.py` corre el flujo SMS completo contra una api falsa.
