export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const redirectUri = `${config.public.appUrl}/auth/callback/gitea`
  const authUrl = `${config.giteaUrl}/login/oauth/authorize?client_id=${config.giteaClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${generateState()}`

  return sendRedirect(event, authUrl)
})

function generateState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}
