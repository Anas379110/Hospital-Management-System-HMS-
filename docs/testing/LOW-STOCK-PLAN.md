# FR6.5 low-stock read-only view

Base2eb936f. Existing SRS-PHARMACY FR6.5 and GET /medications/low-stock define stock<=threshold, pharmacist/Admin only. Current frontend has no hook/view despite historical traceability claim. Preserve backend business/API/schema/dependencies/roles and the existing returned order. No frontend stock comparison, automatic order, metadata editing, substitution or clinical recommendation.

Wireframe: Pharmacy heading, low-stock card, medication-create card, stock-adjustment card, pending prescriptions. Low-stock title and description, explicit Refresh button, loading status, safe error with retry, empty state only after successful empty read, otherwise rows with medication name/unit/current stock/reorder threshold. Existing MUI typography/spacing/card theme, one-column mobile and RTL/LTR translations. Read only, no new mutation.

Use shared medications-prefix query key so existing create/adjust/dispense invalidations refresh this list. Current-session read interceptor and cancellation protect owner changes; no timed polling or new monitoring. Manual refresh fetches current state; data is not advertised as live. Hide stale list on failure rather than show a false empty success.

Qualification: query API/cancellation/shape/error units; actual PG17/18 boundary<= including0, real create/adjust/dispense removal/addition, empty/error/retry/loading, Admin/pharmacist and six forbidden roles, current session isolation, no new write caused by list/refresh, ENdesktop/ARmobile pixels. Independent source review, exact combined CI then hosted fictional workflow, private changed/new exports. Reconcile stale traceability claim with named evidence and limits, not blanket module completion.
