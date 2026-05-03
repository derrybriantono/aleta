# ALETA WhatsApp Production Day-One Monitoring

## Monitor Every 15 Minutes For First 2 Hours

- WhatsApp status
- worker enabled / active timer / paused
- queue pending / processing / failed
- active dead-letter
- approval pending
- policy skip
- sent count per hour
- recipient outliers

## Rollback Thresholds

- queue failed > 0
- active dead-letter > 0
- sent count exceeds approved cap
- any external send without approval
- any duplicate idempotency pattern
- botEnabled true while scheduler/reminder gate is not approved