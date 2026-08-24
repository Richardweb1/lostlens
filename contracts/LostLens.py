# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
LOSTLENS - a GenLayer-judged lost-and-found registry.

Boundary:
- Off-chain app owns photos, maps, chat, notifications, and indexing.
- This contract owns the item registry and the consensus-backed ownership claim
  verdict.

Confidentiality note: contract state is not encrypted. `hidden_description` is
not returned by view methods, but validators and node operators can inspect raw
state. Treat it as non-public UI data, not cryptographic privacy.
"""

from genlayer import *

VERDICT_STRONG = "STRONG_MATCH"
VERDICT_POSSIBLE = "POSSIBLE_MATCH"
VERDICT_NO = "NOT_A_MATCH"

ERROR_LLM = "[LLM_ERROR]"


class LostLens(gl.Contract):
    item_count: u256

    item_public_description: TreeMap[str, str]
    item_hidden_description: TreeMap[str, str]
    item_location: TreeMap[str, str]
    item_finder: TreeMap[str, str]
    item_status: TreeMap[str, str]

    item_last_verdict: TreeMap[str, str]
    item_last_confidence: TreeMap[str, u256]
    item_last_reasoning: TreeMap[str, str]
    item_claim_count: TreeMap[str, u256]

    def __init__(self):
        self.item_count = u256(0)

    @gl.public.write
    def create_item(self, public_description: str, hidden_description: str, location: str) -> u256:
        public_description = public_description.strip()
        hidden_description = hidden_description.strip()
        location = location.strip()

        if len(public_description) == 0:
            raise gl.vm.UserError("PUBLIC_DESCRIPTION_REQUIRED")
        if len(hidden_description) == 0:
            raise gl.vm.UserError("HIDDEN_DESCRIPTION_REQUIRED")
        if len(location) == 0:
            raise gl.vm.UserError("LOCATION_REQUIRED")

        item_id = self.item_count
        key = str(item_id)

        self.item_public_description[key] = public_description
        self.item_hidden_description[key] = hidden_description
        self.item_location[key] = location
        self.item_finder[key] = str(gl.message.sender_address)
        self.item_status[key] = "open"
        self.item_last_verdict[key] = ""
        self.item_last_confidence[key] = u256(0)
        self.item_last_reasoning[key] = ""
        self.item_claim_count[key] = u256(0)

        self.item_count = self.item_count + u256(1)
        return item_id

    def _judge_claim_once(self, hidden_description: str, claimant_description: str) -> str:
        prompt = f"""
You are LostLens, an impartial judge deciding whether someone claiming a lost
item is likely its real owner. Compare a SECRET description only the real owner
should know against a CLAIM submitted by a claimant.

SECRET:
{hidden_description}

CLAIM:
{claimant_description}

Rules:
- Judge by meaning, not exact wording.
- Generic descriptions that could apply to almost any similar item are not enough.
- The claim must include specific details that overlap with the secret.
- Do not quote the secret description verbatim in the reasoning.

Return only JSON:
{{"verdict": "STRONG_MATCH" | "POSSIBLE_MATCH" | "NOT_A_MATCH"}}
"""
        result = gl.nondet.exec_prompt(prompt, response_format="json")
        if not isinstance(result, dict):
            raise gl.vm.UserError(f"{ERROR_LLM} JUDGE_BAD_FORMAT")

        verdict = str(result.get("verdict", "")).upper().strip()
        if verdict not in (VERDICT_STRONG, VERDICT_POSSIBLE, VERDICT_NO):
            raise gl.vm.UserError(f"{ERROR_LLM} JUDGE_BAD_VERDICT")

        return verdict

    def _judge_claim(self, hidden_description: str, claimant_description: str) -> str:
        def leader_fn():
            return self._judge_claim_once(hidden_description, claimant_description)

        return gl.eq_principle.prompt_comparative(
            leader_fn,
            principle=(
                "Both answers are one of STRONG_MATCH, POSSIBLE_MATCH, or "
                "NOT_A_MATCH. They must be exactly the same verdict."
            ),
        )

    @gl.public.write
    def submit_claim(self, item_id: u256, claimant_description: str) -> None:
        if item_id >= self.item_count:
            raise gl.vm.UserError("ITEM_NOT_FOUND")

        claimant_description = claimant_description.strip()
        if len(claimant_description) == 0:
            raise gl.vm.UserError("CLAIM_DESCRIPTION_REQUIRED")

        key = str(item_id)
        if self.item_status[key] == "claimed":
            raise gl.vm.UserError("ITEM_ALREADY_CLAIMED")

        verdict = self._judge_claim(self.item_hidden_description[key], claimant_description)

        self.item_last_verdict[key] = verdict
        if verdict == VERDICT_STRONG:
            self.item_last_confidence[key] = u256(100)
            self.item_last_reasoning[key] = "The claim matched the private identifying details."
        elif verdict == VERDICT_POSSIBLE:
            self.item_last_confidence[key] = u256(50)
            self.item_last_reasoning[key] = "The claim partially matched the private identifying details."
        else:
            self.item_last_confidence[key] = u256(0)
            self.item_last_reasoning[key] = "The claim did not match the private identifying details."
        self.item_claim_count[key] = self.item_claim_count[key] + u256(1)

        if verdict == VERDICT_STRONG:
            self.item_status[key] = "claimed"

    @gl.public.view
    def get_item(self, item_id: u256) -> dict:
        if item_id >= self.item_count:
            raise gl.vm.UserError("ITEM_NOT_FOUND")

        key = str(item_id)
        return {
            "id": int(item_id),
            "public_description": self.item_public_description[key],
            "location": self.item_location[key],
            "finder": self.item_finder[key],
            "status": self.item_status[key],
            "last_verdict": self.item_last_verdict[key],
            "last_confidence": int(self.item_last_confidence[key]),
            "last_reasoning": self.item_last_reasoning[key],
            "claim_count": int(self.item_claim_count[key]),
        }

    @gl.public.view
    def get_all_items(self) -> list[dict]:
        items = []
        i = u256(0)
        while i < self.item_count:
            items.append(self.get_item(i))
            i = i + u256(1)
        return items

    @gl.public.view
    def get_item_count(self) -> u256:
        return self.item_count
