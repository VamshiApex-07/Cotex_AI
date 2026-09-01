import api from "../../utils/axios"

// Deliberately re-throws, unlike the other feature modules that swallow errors
// and return [] or null. The auth UI needs the failure to render an error
// state, and toAuthMessage() reads error.response to pick the copy.
const login = async (token) => {
    const { data } = await api.post("/api/auth/login", { token })
    return data
}

export default login
