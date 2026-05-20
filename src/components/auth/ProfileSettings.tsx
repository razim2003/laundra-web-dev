"use client";

import { useEffect, useState } from "react";
import { useSupabaseUser } from "@/lib/supabase/session";

const fieldStyle = {
  width: "100%",
  border: "3px solid var(--black)",
  padding: "12px 14px",
  fontFamily: "Inter",
  fontWeight: 700,
  fontSize: 14,
  outline: "none",
  background: "white",
} as const;

const labelStyle = {
  fontFamily: "Space Grotesk",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 8,
  display: "block",
  opacity: 0.65,
} as const;

type RiderFields = {
  city: string;
  vehicle_type: string;
};

export default function ProfileSettings() {
  const { supabase, user, profile } = useSupabaseUser();
  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [riderFields, setRiderFields] = useState<RiderFields>({ city: "", vehicle_type: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fullName = fullNameDraft ?? profile?.full_name ?? "";
  const phone = phoneDraft ?? profile?.phone ?? "";

  useEffect(() => {
    if (!supabase || !user || profile?.role !== "rider") return;
    let mounted = true;

    supabase
      .from("riders")
      .select("city,vehicle_type")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data) return;
        setRiderFields({
          city: data.city ?? "",
          vehicle_type: data.vehicle_type ?? "",
        });
      });

    return () => {
      mounted = false;
    };
  }, [supabase, user, profile?.role]);

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase || !user) throw new Error("Sign in again before updating your profile.");

      const cleanName = fullName.trim();
      const cleanPhone = phone.trim();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: cleanName || null, phone: cleanPhone || null })
        .eq("id", user.id);
      if (profileError) throw profileError;

      const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: cleanName || null, phone: cleanPhone || null },
      });
      if (metaError) throw metaError;

      if (profile?.role === "rider") {
        const { error: riderError } = await supabase
          .from("riders")
          .upsert({
            id: user.id,
            city: riderFields.city.trim() || null,
            vehicle_type: riderFields.vehicle_type.trim() || null,
          }, { onConflict: "id" });
        if (riderError) throw riderError;
      }

      if (newPassword || confirmPassword) {
        if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
        if (newPassword !== confirmPassword) throw new Error("Password confirmation does not match.");

        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
        setNewPassword("");
        setConfirmPassword("");
      }

      setMessage("Profile updated.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-settings">
      <div className="profile-settings-grid">
        <div>
          <label style={labelStyle}>Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullNameDraft(e.target.value)}
            placeholder="Your name"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="+94..."
            style={fieldStyle}
          />
        </div>
        {profile?.role === "rider" && (
          <>
            <div>
              <label style={labelStyle}>City</label>
              <input
                value={riderFields.city}
                onChange={(e) => setRiderFields((f) => ({ ...f, city: e.target.value }))}
                placeholder="Colombo"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Vehicle</label>
              <input
                value={riderFields.vehicle_type}
                onChange={(e) => setRiderFields((f) => ({ ...f, vehicle_type: e.target.value }))}
                placeholder="Bike, van, three-wheeler"
                style={fieldStyle}
              />
            </div>
          </>
        )}
      </div>

      <div className="profile-password-card">
        <div className="config-title" style={{ marginBottom: 16 }}>
          Password reset
        </div>
        <div className="profile-settings-grid">
          <div>
            <label style={labelStyle}>New password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              style={fieldStyle}
            />
          </div>
        </div>
      </div>

      <button className="btn-yellow" type="button" onClick={saveProfile} disabled={saving || !supabase}>
        {saving ? "Saving..." : "Save profile"}
      </button>
      {message && <div className="profile-settings-note success">{message}</div>}
      {error && <div className="profile-settings-note error">{error}</div>}
    </div>
  );
}
