"""Memoria de sesión por teléfono (en memoria; basta para la demo)."""

from dataclasses import dataclass, field


@dataclass
class Session:
    phone: str
    profile: dict
    history: list = field(default_factory=list)  # mensajes para el LLM
    options: list[dict] = field(default_factory=list)  # última búsqueda
    pending: dict | None = None  # {pendingId, option}


_sessions: dict[str, Session] = {}


def get(phone: str, profile: dict) -> Session:
    s = _sessions.get(phone)
    if not s:
        s = _sessions[phone] = Session(phone=phone, profile=profile)
    s.profile = profile
    return s


def reset_all() -> None:
    _sessions.clear()
