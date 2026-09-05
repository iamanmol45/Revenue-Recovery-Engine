import os
import json
import logging
from typing import Dict, Any

from pydantic import ValidationError
import openai

from agents.schemas import RecoveryDecision

logger = logging.getLogger(__name__)

class LLMConfigurationError(Exception):
    """Raised when the LLM is improperly configured or disabled."""
    pass

class LLMExecutionError(Exception):
    """Raised when the LLM API call fails or returns an invalid response."""
    pass

def generate_recovery_decision(context: Dict[str, Any]) -> RecoveryDecision:
    """
    Calls the LLM provider to evaluate the recovery context and return a structured decision.
    """
    llm_enabled = os.environ.get("LLM_ENABLED", "false").lower() == "true"
    if not llm_enabled:
        raise LLMConfigurationError("LLM integration is currently disabled via configuration.")
        
    api_key = os.environ.get("OPENROUTER_API_KEY")
    model_name = os.environ.get("OPENROUTER_MODEL")
    site_url = os.environ.get("OPENROUTER_SITE_URL")
    app_name = os.environ.get("OPENROUTER_APP_NAME")
    
    if not api_key:
        raise LLMConfigurationError("OPENROUTER_API_KEY is not configured.")
        
    if not model_name:
        raise LLMConfigurationError("OPENROUTER_MODEL is not configured.")
        
    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1"
    )
    
    max_tokens = int(os.environ.get("LLM_MAX_TOKENS", "500"))
    
    system_prompt = (
        "You are an AI Revenue Recovery Decision Engine.\n"
        "Analyze the context: ML risk, customer behavior, and transaction info.\n"
        "1. Identify the main risk.\n"
        "2. Select exactly ONE allowed recovery action.\n"
        "3. Provide a SHORT reason (1-2 sentences).\n"
        "4. Output a confidence score (0-1).\n"
        "Do not invent data. Output valid JSON matching the RecoveryDecision schema."
    )
    
    user_prompt = f"Evaluate the following revenue recovery context and output a structured decision:\n\n{json.dumps(context, indent=2)}"
    
    headers = {}
    if site_url:
        headers["HTTP-Referer"] = site_url
    if app_name:
        headers["X-Title"] = app_name

    logger.info(f"[LLM] Request started using model: {model_name}")
    import time
    start_time = time.time()
    
    decision = None
    try:
        # First attempt: structured response parse
        completion = client.beta.chat.completions.parse(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format=RecoveryDecision,
            extra_headers=headers,
            max_tokens=max_tokens
        )
        
        decision_message = completion.choices[0].message
        
        if hasattr(completion, 'usage') and completion.usage:
            print("TOKEN USAGE:", completion.usage)
        
        if decision_message.parsed:
            decision = decision_message.parsed
            logger.info("[LLM] Successful structured response validated")
        elif decision_message.refusal:
            logger.error("[LLM] Model refused to respond.")
            raise LLMExecutionError("LLM refused to generate a decision.")
        else:
            raw_content = decision_message.content
            if not raw_content:
                raise ValueError("Empty response content.")
            parsed_dict = json.loads(raw_content)
            decision = RecoveryDecision.model_validate(parsed_dict)
            logger.info("[LLM] Successful structured response validated (fallback from content)")

    except Exception as parse_error:
        # Some models on OpenRouter don't support .parse() or response_format yet
        logger.warning(f"[LLM] .parse() failed or unsupported ({type(parse_error).__name__}). Attempting safe JSON fallback...")
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                extra_headers=headers,
                max_tokens=max_tokens
            )
            raw_content = completion.choices[0].message.content
            
            if hasattr(completion, 'usage') and completion.usage:
                print("TOKEN USAGE:", completion.usage)
            if not raw_content:
                raise ValueError("Empty response content.")
            
            # Clean up markdown JSON wrappers if present
            raw_content = raw_content.strip()
            if raw_content.startswith("```json"):
                raw_content = raw_content[7:]
            if raw_content.endswith("```"):
                raw_content = raw_content[:-3]
                
            parsed_dict = json.loads(raw_content)
            decision = RecoveryDecision.model_validate(parsed_dict)
            logger.info("[LLM] Successful structured response validated (safe JSON fallback)")
            
        except openai.APIConnectionError as e:
            logger.error(f"[LLM] Network failure connecting to provider. Type: {type(e).__name__}")
            raise LLMExecutionError("Network failure connecting to LLM provider.") from e
        except openai.APITimeoutError as e:
            logger.error(f"[LLM] Request timed out. Type: {type(e).__name__}")
            raise LLMExecutionError("LLM request timed out.") from e
        except openai.AuthenticationError as e:
            logger.error(f"[LLM] Authentication failed. Type: {type(e).__name__}")
            raise LLMExecutionError("LLM authentication failed.") from e
        except openai.APIStatusError as e:
            logger.error(f"[LLM] API error: {e.status_code} - {str(e)}")
            raise LLMExecutionError(f"LLM API error: {e.status_code} - {str(e)}") from e
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            logger.error(f"[LLM] Validation failure on fallback parsing. Type: {type(e).__name__}")
            raise LLMExecutionError("Failed to parse and validate LLM output.") from e
        except Exception as e:
            logger.error(f"[LLM] Unexpected execution failure. Type: {type(e).__name__}")
            raise LLMExecutionError("Unexpected error during LLM execution.") from e

    duration = time.time() - start_time
    logger.info(f"[LLM] Response received in {duration:.2f} seconds")
    return decision
