import pytest
import json
import database.init_db  # Pre-load to avoid circular import in agents/__init__.py
from unittest.mock import patch, MagicMock

import openai
from pydantic import ValidationError

from agents.schemas import RecoveryDecision, RecoveryActionEnum
from agents.llm_client import (
    generate_recovery_decision,
    LLMConfigurationError,
    LLMExecutionError
)


@pytest.fixture
def dummy_context():
    return {
        "payment": {"amount": 100},
        "ml_prediction": {"priority": "Critical"}
    }


@pytest.fixture
def valid_decision_obj():
    return RecoveryDecision(
        diagnosis="Test diagnosis",
        risk_assessment="high",
        evidence=["test evidence"],
        recommended_action=RecoveryActionEnum.RETRY_PAYMENT,
        action_reason="Test reason",
        confidence=0.9,
        expected_outcome="Test outcome",
        escalation_required=False,
        stopping_condition="Test condition"
    )


def test_llm_disabled(dummy_context, monkeypatch):
    """Test 2: LLM disabled"""
    monkeypatch.setenv("LLM_ENABLED", "false")
    with pytest.raises(LLMConfigurationError) as exc:
        generate_recovery_decision(dummy_context)
    assert "disabled" in str(exc.value).lower()


def test_missing_api_key(dummy_context, monkeypatch):
    """Test 3: Missing API key when enabled"""
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")
    with pytest.raises(LLMConfigurationError) as exc:
        generate_recovery_decision(dummy_context)
    assert "LLM_API_KEY" in str(exc.value)


def test_missing_model(dummy_context, monkeypatch):
    """Test 4: Missing model"""
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_API_KEY", "fake_key")
    monkeypatch.delenv("LLM_MODEL", raising=False)
    with pytest.raises(LLMConfigurationError) as exc:
        generate_recovery_decision(dummy_context)
    assert "LLM_MODEL" in str(exc.value)


@patch("agents.llm_client.openai.OpenAI")
def test_valid_structured_llm_response(mock_openai_class, dummy_context, valid_decision_obj, monkeypatch):
    """Test 1: Valid structured LLM response
       Test 8: Verify the returned object is a RecoveryDecision
       Test 9: Verify the client passes the supplied context to the LLM
    """
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_API_KEY", "fake_key")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")

    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client
    
    # Mock completion object
    mock_completion = MagicMock()
    mock_message = MagicMock()
    mock_message.parsed = valid_decision_obj
    mock_message.refusal = None
    mock_completion.choices = [MagicMock(message=mock_message)]
    
    mock_client.beta.chat.completions.parse.return_value = mock_completion
    
    result = generate_recovery_decision(dummy_context)
    
    assert isinstance(result, RecoveryDecision)
    assert result.recommended_action == RecoveryActionEnum.RETRY_PAYMENT
    
    # Verify the context was passed
    mock_client.beta.chat.completions.parse.assert_called_once()
    call_kwargs = mock_client.beta.chat.completions.parse.call_args.kwargs
    messages = call_kwargs.get("messages", [])
    
    # Check user message contains the JSON context
    user_message = next((m for m in messages if m["role"] == "user"), None)
    assert user_message is not None
    assert "100" in user_message["content"]
    assert "Critical" in user_message["content"]


@patch("agents.llm_client.openai.OpenAI")
def test_provider_api_failure(mock_openai_class, dummy_context, monkeypatch):
    """Test 5: Provider/API failure"""
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_API_KEY", "fake_key")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")

    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client
    
    mock_client.beta.chat.completions.parse.side_effect = openai.APIConnectionError(
        message="Network failure",
        request=MagicMock()
    )
    
    with pytest.raises(LLMExecutionError) as exc:
        generate_recovery_decision(dummy_context)
    assert "Network failure" in str(exc.value)


@patch("agents.llm_client.openai.OpenAI")
def test_invalid_structured_response(mock_openai_class, dummy_context, monkeypatch):
    """Test 6 & 7: Invalid structured response & Pydantic validation failure"""
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_API_KEY", "fake_key")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")

    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client
    
    # Simulate SDK failing to parse and returning raw content instead
    mock_completion = MagicMock()
    mock_message = MagicMock()
    mock_message.parsed = None
    mock_message.refusal = None
    
    # Provide an invalid action enum value
    bad_payload = {
        "diagnosis": "Test",
        "risk_assessment": "high",
        "evidence": ["test"],
        "recommended_action": "Not a valid action",
        "action_reason": "Test",
        "confidence": 0.9,
        "expected_outcome": "Test",
        "escalation_required": False,
        "stopping_condition": "Test"
    }
    mock_message.content = json.dumps(bad_payload)
    mock_completion.choices = [MagicMock(message=mock_message)]
    
    mock_client.beta.chat.completions.parse.return_value = mock_completion
    
    with pytest.raises(LLMExecutionError) as exc:
        generate_recovery_decision(dummy_context)
    assert "Failed to parse and validate LLM output" in str(exc.value)


@patch("agents.llm_client.openai.OpenAI")
def test_llm_refusal(mock_openai_class, dummy_context, monkeypatch):
    """Test 6: Invalid structured response (refusal)"""
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_API_KEY", "fake_key")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o")

    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client
    
    mock_completion = MagicMock()
    mock_message = MagicMock()
    mock_message.parsed = None
    mock_message.refusal = "I refuse"
    mock_completion.choices = [MagicMock(message=mock_message)]
    
    mock_client.beta.chat.completions.parse.return_value = mock_completion
    
    with pytest.raises(LLMExecutionError) as exc:
        generate_recovery_decision(dummy_context)
    assert "refused" in str(exc.value).lower()
