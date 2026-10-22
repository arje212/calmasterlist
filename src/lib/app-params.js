const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('token');
}

const getAccessToken = () => !isNode ? window.localStorage.getItem('token') : null;

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: import.meta.env.VITE_APP_ID || 'calibratrack-local',
		token: getAccessToken(),
		functionsVersion: import.meta.env.VITE_FUNCTIONS_VERSION,
		appBaseUrl: import.meta.env.VITE_APP_BASE_URL,
	}
}


export const appParams = {
	...getAppParams()
}
