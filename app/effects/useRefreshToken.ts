import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { authApi } from '../services/api';
import { RootState, AppDispatch } from '../store/store';

const useRefreshToken = () => {
    const dispatch = useDispatch<AppDispatch>();
    const tokens = useSelector((state: RootState) => state.auth.tokens);

    useEffect(() => {
        if (tokens && new Date(Number(tokens.access.expires) * 1000).getTime() < Date.now()) {
            dispatch(authApi.endpoints.refreshTokens.initiate({ refreshToken: tokens.refresh.token }))
                .unwrap()
                .catch((error) => {
                    console.error('Failed to refresh tokens', error);
                });
        }
    }, [dispatch, tokens]);
};

export default useRefreshToken;
