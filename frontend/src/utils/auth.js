export const getUser = () => JSON.parse(localStorage.getItem("taxora_user") || "null");
export const saveSession = (token, user) => { localStorage.setItem("taxora_token", token); localStorage.setItem("taxora_user", JSON.stringify(user)); };
export const logout = () => { localStorage.clear(); window.location.href = "/login"; };
