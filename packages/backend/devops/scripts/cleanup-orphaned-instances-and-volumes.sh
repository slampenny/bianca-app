#!/usr/bin/env bash
# Clean up orphaned EC2 instances and EBS volumes from blue-green deployments.
#
# Orphaned instances: Running or stopped instances still tagged as "green"
#   (bianca-staging-green, bianca-production-green) that were left behind when
#   a pipeline failed or was cancelled before renaming green to blue.
#
# Orphaned EBS volumes: Unattached volumes tagged as our MongoDB data volumes
#   (bianca-staging-mongodb-data, bianca-production-mongodb-data). These can
#   accumulate if a volume was detached (e.g. instance terminated) and never
#   reattached by the pipeline.
#
# Usage:
#   ./cleanup-orphaned-instances-and-volumes.sh              # Dry run (list only)
#   ./cleanup-orphaned-instances-and-volumes.sh --execute   # Actually terminate/delete
#
# Uses AWS_PROFILE from environment if set (e.g. AWS_PROFILE=jordan).

set -e

EXECUTE=false
REGION="${AWS_REGION:-us-east-2}"
PROFILE="${AWS_PROFILE:-}"

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=true ;;
    -h|--help)
      echo "Usage: $0 [--execute]"
      echo "  Default: dry run (list orphaned resources only)"
      echo "  --execute: terminate orphaned instances and delete orphaned EBS volumes"
      exit 0
      ;;
  esac
done

AWS_CMD="aws"
[ -n "$PROFILE" ] && AWS_CMD="aws --profile $PROFILE"

echo "=== Cleanup orphaned EC2 instances and EBS volumes ==="
echo "Region: $REGION"
[ -n "$PROFILE" ] && echo "Profile: $PROFILE"
echo "Mode: $([ "$EXECUTE" = true ] && echo 'EXECUTE' || echo 'DRY RUN (use --execute to apply)')"
echo ""

# --- Orphaned instances (green-tagged, any state) ---
GREEN_NAMES="bianca-staging-green bianca-production-green"
ORPHAN_INSTANCES=()
for name in $GREEN_NAMES; do
  ids=$($AWS_CMD ec2 describe-instances \
    --region "$REGION" \
    --filters "Name=tag:Name,Values=$name" "Name=instance-state-name,Values=running,stopped,stopping,pending" \
    --query 'Reservations[*].Instances[*].InstanceId' \
    --output text 2>/dev/null || true)
  for id in $ids; do
    [ -n "$id" ] && [ "$id" != "None" ] && ORPHAN_INSTANCES+=("$id")
  done
done

if [ ${#ORPHAN_INSTANCES[@]} -eq 0 ]; then
  echo "No orphaned EC2 instances (green-tagged) found."
else
  echo "Orphaned EC2 instances (Name=bianca-*-green):"
  for iid in "${ORPHAN_INSTANCES[@]}"; do
    state=$($AWS_CMD ec2 describe-instances --region "$REGION" --instance-ids "$iid" \
      --query 'Reservations[0].Instances[0].[State.Name,Tags[?Key==`Name`].Value|[0]]' --output text 2>/dev/null || echo "unknown")
    echo "  $iid  $state"
  done
  if [ "$EXECUTE" = true ]; then
    echo "Terminating ${#ORPHAN_INSTANCES[@]} instance(s)..."
    $AWS_CMD ec2 terminate-instances --region "$REGION" --instance-ids "${ORPHAN_INSTANCES[@]}"
    echo "  Done. Instances are shutting down."
  else
    echo "  (Run with --execute to terminate these instances)"
  fi
fi
echo ""

# --- Orphaned EBS volumes (unattached, our MongoDB volume names) ---
VOLUME_NAMES="bianca-staging-mongodb-data bianca-production-mongodb-data"
ORPHAN_VOLUMES=()
for vname in $VOLUME_NAMES; do
  ids=$($AWS_CMD ec2 describe-volumes \
    --region "$REGION" \
    --filters "Name=tag:Name,Values=$vname" "Name=status,Values=available" \
    --query 'Volumes[*].VolumeId' \
    --output text 2>/dev/null || true)
  for vid in $ids; do
    [ -n "$vid" ] && [ "$vid" != "None" ] && ORPHAN_VOLUMES+=("$vid")
  done
done

if [ ${#ORPHAN_VOLUMES[@]} -eq 0 ]; then
  echo "No orphaned EBS volumes (unattached MongoDB data volumes) found."
else
  echo "Orphaned EBS volumes (unattached, Name=bianca-*-mongodb-data):"
  for vid in "${ORPHAN_VOLUMES[@]}"; do
    name_size=$($AWS_CMD ec2 describe-volumes --region "$REGION" --volume-ids "$vid" \
      --query 'Volumes[0].[Tags[?Key==`Name`].Value|[0],Size]' --output text 2>/dev/null || echo "unknown")
    echo "  $vid  $name_size"
  done
  if [ "$EXECUTE" = true ]; then
    echo "Deleting ${#ORPHAN_VOLUMES[@]} volume(s)..."
    for vid in "${ORPHAN_VOLUMES[@]}"; do
      $AWS_CMD ec2 delete-volume --region "$REGION" --volume-id "$vid" && echo "  Deleted $vid" || echo "  Failed to delete $vid"
    done
  else
    echo "  (Run with --execute to delete these volumes)"
  fi
fi
echo ""
echo "Done."
