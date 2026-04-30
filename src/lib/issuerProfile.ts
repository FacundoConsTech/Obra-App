import { supabase } from './supabase';

export type IssuerProfile = {
  company_name: string;
  cuit_cuil: string;
  address: string;
  phone: string;
};

const EMPTY_PROFILE: IssuerProfile = {
  company_name: '',
  cuit_cuil: '',
  address: '',
  phone: '',
};

const sanitize = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const getEmptyIssuerProfile = (): IssuerProfile => ({ ...EMPTY_PROFILE });

export const loadIssuerProfile = async (): Promise<IssuerProfile> => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return getEmptyIssuerProfile();

  const raw = data.user.user_metadata?.issuer_profile as Record<string, unknown> | undefined;
  if (!raw) return getEmptyIssuerProfile();

  return {
    company_name: sanitize(raw.company_name),
    cuit_cuil: sanitize(raw.cuit_cuil),
    address: sanitize(raw.address),
    phone: sanitize(raw.phone),
  };
};

export const saveIssuerProfile = async (profile: IssuerProfile): Promise<void> => {
  const payload = {
    company_name: sanitize(profile.company_name),
    cuit_cuil: sanitize(profile.cuit_cuil),
    address: sanitize(profile.address),
    phone: sanitize(profile.phone),
  };

  const { error } = await supabase.auth.updateUser({
    data: { issuer_profile: payload },
  });

  if (error) {
    throw error;
  }
};
