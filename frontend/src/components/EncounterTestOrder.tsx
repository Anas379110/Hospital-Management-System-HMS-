import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useCreateTestOrder } from "../hooks/useLab";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import { holdTestOrder } from "./testOrderOutcome";

/** Existing doctor-owned encounter API. No result, triage or clinical approval logic. */
export default function EncounterTestOrder({
  patientId,
  encounterId,
}: {
  patientId: string;
  encounterId: string;
}) {
  const { t } = useTranslation();
  const mutation = useCreateTestOrder();
  const key = "hms_test_order_unknown:" + encounterId;
  const [held, setHeld] = useState(
    () => sessionStorage.getItem(key) === "true",
  );
  const [testType, setTestType] = useState<"lab" | "radiology">("lab");
  const [testName, setTestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function submit() {
    if (held || mutation.isPending || testName.length < 2) return;
    setError(null);
    setSaved(false);
    try {
      await mutation.mutateAsync({
        patientId,
        encounterId,
        testType,
        testName,
      });
      setTestName("");
      setSaved(true);
    } catch (err) {
      if (holdTestOrder(err)) {
        sessionStorage.setItem(key, "true");
        setHeld(true);
      } else
        setError(
          getApiErrorCode(err) === "AUDIT_PERSISTENCE_FAILED"
            ? t("departments.auditFailure")
            : getApiErrorMessage(err, t("errors.generic")),
        );
    }
  }
  return (
    <Box
      component="section"
      aria-label={t("testOrder.title")}
      sx={{ mt: 3, pt: 2, borderTop: "1px solid #dbe3e8" }}
    >
      <Typography variant="subtitle2" mb={1}>
        {t("testOrder.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        {t("testOrder.encounter")}
      </Typography>
      {saved && (
        <Alert severity="success" role="status">
          {t("testOrder.saved")}
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {held ? (
        <Alert severity="warning">
          {t("testOrder.unknown")}
          <Button
            onClick={() => {
              sessionStorage.removeItem(key);
              setHeld(false);
              setTestName("");
            }}
          >
            {t("testOrder.checked")}
          </Button>
        </Alert>
      ) : (
        <Stack gap={2}>
          <TextField
            id="encounter-test-type"
            SelectProps={{ inputProps: { "aria-label": t("testOrder.type") } }}
            select
            label={t("testOrder.type")}
            value={testType}
            disabled={mutation.isPending}
            onChange={(e) => setTestType(e.target.value as "lab" | "radiology")}
          >
            <MenuItem value="lab">{t("emr.lab")}</MenuItem>
            <MenuItem value="radiology">{t("emr.radiology")}</MenuItem>
          </TextField>
          <TextField
            id="encounter-test-name"
            label={t("testOrder.name")}
            value={testName}
            disabled={mutation.isPending}
            onChange={(e) => setTestName(e.target.value)}
          />
          <Button
            variant="outlined"
            disabled={mutation.isPending || testName.length < 2}
            onClick={() => void submit()}
          >
            {t("testOrder.submit")}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
