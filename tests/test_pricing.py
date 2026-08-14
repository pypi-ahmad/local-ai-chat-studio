from backend.app.pricing import model_pricing, openrouter_pricing


def test_catalog_returns_official_token_rates(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    openai = model_pricing("openai", "gpt-5.4-mini-2026-03-17")
    gemini = model_pricing("gemini", "gemini-2.5-flash")
    agnes = model_pricing("agnes", "agnes-2.5-flash")

    assert openai and (openai.input_per_million, openai.output_per_million) == (
        0.75,
        4.5,
    )
    assert gemini and (gemini.input_per_million, gemini.output_per_million) == (
        0.3,
        2.5,
    )
    assert agnes and (agnes.input_per_million, agnes.output_per_million) == (0, 0)


def test_unknown_model_has_no_invented_price() -> None:
    assert model_pricing("openai", "future-model") is None


def test_custom_openai_gateway_has_no_official_openai_price(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_BASE_URL", "https://gateway.example.test/v1")

    assert model_pricing("openai", "gpt-5.4") is None


def test_openrouter_converts_official_per_token_rates() -> None:
    pricing = openrouter_pricing({"prompt": "0.0000025", "completion": "0.00001"})

    assert pricing and (pricing.input_per_million, pricing.output_per_million) == (
        2.5,
        10,
    )
