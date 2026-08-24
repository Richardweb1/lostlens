import json


def test_create_item_returns_public_data_only(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/LostLens.py")
    direct_vm.sender = direct_alice

    item_id = contract.create_item(
        "Black backpack found near the library",
        "Inside pocket has a blue keychain and a physics notebook",
        "Campus library",
    )

    assert int(item_id) == 0
    assert int(contract.get_item_count()) == 1

    item = contract.get_item(item_id)
    assert item["public_description"] == "Black backpack found near the library"
    assert item["location"] == "Campus library"
    assert item["status"] == "open"
    assert item["last_verdict"] == ""
    assert item["claim_count"] == 0
    assert "hidden_description" not in item


def test_create_item_requires_descriptions_and_location(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/LostLens.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("PUBLIC_DESCRIPTION_REQUIRED"):
        contract.create_item("", "secret", "station")

    with direct_vm.expect_revert("HIDDEN_DESCRIPTION_REQUIRED"):
        contract.create_item("wallet", "", "station")

    with direct_vm.expect_revert("LOCATION_REQUIRED"):
        contract.create_item("wallet", "red sticker inside", "")


def test_submit_claim_marks_strong_match_claimed(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/LostLens.py")
    direct_vm.sender = direct_alice
    item_id = contract.create_item(
        "Silver laptop",
        "There is a moon sticker beside the trackpad",
        "Main hall",
    )

    direct_vm.mock_llm(
        r".*moon sticker.*",
        json.dumps(
            {
                "verdict": "STRONG_MATCH",
                "confidence": 92,
                "reasoning": "The claim includes a specific private detail.",
            }
        ),
    )

    direct_vm.sender = direct_bob
    contract.submit_claim(item_id, "My laptop has the moon sticker near the trackpad.")

    item = contract.get_item(item_id)
    assert item["status"] == "claimed"
    assert item["last_verdict"] == "STRONG_MATCH"
    assert item["last_confidence"] == 100
    assert item["claim_count"] == 1


def test_submit_claim_keeps_item_open_for_non_match(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/LostLens.py")
    direct_vm.sender = direct_alice
    item_id = contract.create_item("Phone", "Cracked case with initials AR", "Cafe")

    direct_vm.mock_llm(
        r".*Cracked case.*",
        json.dumps(
            {
                "verdict": "NOT_A_MATCH",
                "confidence": 88,
                "reasoning": "The claim lacks the private identifying detail.",
            }
        ),
    )

    direct_vm.sender = direct_bob
    contract.submit_claim(item_id, "It is a phone.")

    item = contract.get_item(item_id)
    assert item["status"] == "open"
    assert item["last_verdict"] == "NOT_A_MATCH"
    assert item["claim_count"] == 1
