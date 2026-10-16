import pytest

from intent.compiler import InvalidTree, Node, compile_rules, validate


def test_reglas_generan_arbol_valido():
    node = compile_rules("hasta 300 dólares al mes para mi mamá y María; medicinas sin preguntar hasta 10 dólares")
    validate(node)
    assert node.maxUsd == 300
    assert node.children[1].pinThresholdUsd == 10


def test_hijos_que_suman_mas_que_el_padre_se_rechazan():
    bad = Node(holderName="Juan", holderType="person", maxUsd=10, categories=["mercado"], children=[
        Node(holderName="A", holderType="person", maxUsd=8, categories=["mercado"]),
        Node(holderName="B", holderType="person", maxUsd=8, categories=["mercado"]),
    ])
    with pytest.raises(InvalidTree):
        validate(bad)


def test_categorias_fuera_del_padre_se_rechazan():
    bad = Node(holderName="Juan", holderType="person", maxUsd=10, categories=["mercado"], children=[
        Node(holderName="A", holderType="person", maxUsd=5, categories=["efectivo"]),
    ])
    with pytest.raises(InvalidTree):
        validate(bad)
