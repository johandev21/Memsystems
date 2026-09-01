import { useState } from "react";

export type AddSourceMode = "menu" | "url" | "text";

export function useAddSourceDialogState() {
  const [mode, setMode] = useState<AddSourceMode>("menu");
  const [urlValue, setUrlValue] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [oauthToken, setOauthToken] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");

  const reset = () => {
    setMode("menu");
    setUrlValue("");
    setUrlTitle("");
    setCaptionText("");
    setOauthToken("");
    setTextTitle("");
    setTextBody("");
  };

  return {
    mode,
    setMode,
    urlValue,
    setUrlValue,
    urlTitle,
    setUrlTitle,
    captionText,
    setCaptionText,
    oauthToken,
    setOauthToken,
    textTitle,
    setTextTitle,
    textBody,
    setTextBody,
    reset,
  };
}
