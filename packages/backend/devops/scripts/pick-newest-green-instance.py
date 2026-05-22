#!/usr/bin/env python3
"""Read describe-instances JSON from stdin; print newest running green instance id."""
import json
import sys


def is_green(instance: dict) -> bool:
    tags = instance.get("Tags") or []
    return any(
        t.get("Key") == "DeploymentType" and t.get("Value") == "green" for t in tags
    )


def main() -> None:
    data = json.load(sys.stdin)
    candidates = []
    for reservation in data.get("Reservations") or []:
        for instance in reservation.get("Instances") or []:
            launch = instance.get("LaunchTime") or ""
            iid = instance.get("InstanceId")
            if not iid:
                continue
            if is_green(instance):
                candidates.append((launch, iid))
    if not candidates:
        for reservation in data.get("Reservations") or []:
            for instance in reservation.get("Instances") or []:
                launch = instance.get("LaunchTime") or ""
                iid = instance.get("InstanceId")
                if iid:
                    candidates.append((launch, iid))
    candidates.sort()
    print(candidates[-1][1] if candidates else "")


if __name__ == "__main__":
    main()
