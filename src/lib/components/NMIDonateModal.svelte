<script lang="ts">
	import { tick } from 'svelte';
	import { env } from '$env/dynamic/public';

	interface Props {
		open: boolean;
		amount: number;
		currencySymbol?: string;
		onClose: () => void;
		onSuccess: (info: { transactionId?: string; orderId?: string }) => void;
	}

	const { open, amount, currencySymbol = '$', onClose, onSuccess }: Props = $props();

	type Status = 'loading' | 'ready' | 'processing' | 'success' | 'error';
	let status = $state<Status>('loading');
	let errorMsg = $state('');

	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let postalCode = $state('');

	const PUBLIC_KEY = env.PUBLIC_NMI_PUBLIC_KEY || '';
	const COLLECT_SRC = 'https://secure.nmi.com/token/Collect.js';

	let scriptPromise: Promise<void> | null = null;
	let configuredOnce = false;

	function loadCollectScript(): Promise<void> {
		// biome-ignore lint/suspicious/noExplicitAny: window global
		const w = window as any;
		if (w.CollectJS) return Promise.resolve();
		if (scriptPromise) return scriptPromise;
		scriptPromise = new Promise((resolve, reject) => {
			const existing = document.querySelector(
				`script[src="${COLLECT_SRC}"]`
			) as HTMLScriptElement | null;
			if (existing) {
				if (w.CollectJS) return resolve();
				existing.addEventListener('load', () => resolve());
				existing.addEventListener('error', () => reject(new Error('Collect.js failed to load')));
				return;
			}
			const s = document.createElement('script');
			s.src = COLLECT_SRC;
			s.async = true;
			s.setAttribute('data-tokenization-key', PUBLIC_KEY);
			s.onload = () => resolve();
			s.onerror = () => reject(new Error('Collect.js failed to load'));
			document.head.appendChild(s);
		});
		return scriptPromise;
	}

	function configureCollect() {
		// biome-ignore lint/suspicious/noExplicitAny: NMI global
		const CollectJS = (window as any).CollectJS;
		if (!CollectJS) {
			console.warn('[NMI] CollectJS global missing at configure time');
			errorMsg = 'Could not load secure payment. Please refresh the page.';
			status = 'error';
			return;
		}
		try {
			CollectJS.configure({
				variant: 'inline',
				styleSniffer: false,
				customCss: {
					'font-size': '15px',
					'font-family':
						"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
					color: '#111',
					'background-color': 'transparent',
					'border-width': '0',
					'border-style': 'none',
					padding: '0 12px',
					height: '44px',
					'line-height': '44px',
					'box-shadow': 'none',
					outline: 'none'
				},
				invalidCss: { color: '#c53030' },
				validCss: { color: '#111' },
				focusCss: { color: '#111' },
				placeholderCss: { color: '#9ca3af' },
				fields: {
					ccnumber: { selector: '#nmi-ccnumber', placeholder: '4111 1111 1111 1111' },
					ccexp: { selector: '#nmi-ccexp', placeholder: 'MM / YY' },
					cvv: { selector: '#nmi-cvv', placeholder: 'CVV' },
					googlePay: {
						selector: '#nmi-google-pay',
						buttonType: 'donate',
						buttonColor: 'default',
						emailRequired: true
					},
					applePay: {
						selector: '#nmi-apple-pay',
						style: { 'button-type': 'donate', 'button-style': 'black' },
						contactFields: ['email'],
						contactFieldsMappedTo: 'billing'
					}
				},
				price: amount.toFixed(2),
				currency: 'USD',
				country: 'US',
				callback: onCollectCallback,
				validationCallback: onValidation,
				fieldsAvailableCallback: () => {
					status = 'ready';
				},
				timeoutDuration: 15000,
				timeoutCallback: () => {
					console.warn('[NMI] tokenization timed out');
					errorMsg = 'Payment timed out. Please try again.';
					status = 'error';
				}
			});
			configuredOnce = true;
			// Fallback: if fieldsAvailableCallback never fires, mark ready after 1.5s
			setTimeout(() => {
				if (status === 'loading') status = 'ready';
			}, 1500);
		} catch (e) {
			console.error('[NMI] configure error', e);
			errorMsg = 'Could not initialize secure payment.';
			status = 'error';
		}
	}

	function onValidation(_field: string, _valid: boolean, _message: string) {
		// no-op — CollectJS handles UI via CSS classes
	}

	// biome-ignore lint/suspicious/noExplicitAny: NMI response shape
	function onCollectCallback(response: any) {
		if (!response || !response.token) {
			console.warn('[NMI] callback with no token', response);
			errorMsg = 'Could not process card. Please try again.';
			status = 'error';
			return;
		}
		void processPayment(response);
	}

	// biome-ignore lint/suspicious/noExplicitAny: NMI response shape
	async function processPayment(response: any) {
		status = 'processing';
		errorMsg = '';

		const wallet = response.wallet ?? {};
		const walletBilling = wallet.billingInfo ?? {};
		const walletEmail = wallet.email || walletBilling.email || '';

		const billing = {
			first_name: (firstName || walletBilling.firstName || 'Donor').trim(),
			last_name: (lastName || walletBilling.lastName || 'Anonymous').trim(),
			postal_code: (postalCode || walletBilling.postalCode || '00000').trim(),
			country: walletBilling.country || 'US',
			email: (email || walletEmail || '').trim()
		};

		try {
			const res = await fetch('/api/nmi/donate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					amount,
					token: response.token,
					tokenType: response.tokenType,
					billing,
					orderDescription: `Ellie donation ${currencySymbol}${amount}`
				})
			});
			let data: { success?: boolean; error?: string; transactionId?: string; orderId?: string } =
				{};
			try {
				data = await res.json();
			} catch {
				// non-JSON response
			}
			if (res.ok && data.success) {
				status = 'success';
				onSuccess({ transactionId: data.transactionId, orderId: data.orderId });
			} else {
				console.warn('[NMI] payment failed', res.status, data);
				errorMsg =
					data.error ||
					`Payment failed (HTTP ${res.status}). Please try another card.`;
				status = 'error';
			}
		} catch (e) {
			console.error('[NMI] network error', e);
			errorMsg = 'Network error. Please try again.';
			status = 'error';
		}
	}

	function submitCard(e: Event) {
		e.preventDefault();
		if (!firstName.trim() || !lastName.trim() || !email.trim() || !postalCode.trim()) {
			errorMsg = 'Please fill in all fields above.';
			return;
		}
		errorMsg = '';
		// biome-ignore lint/suspicious/noExplicitAny: NMI global
		const CollectJS = (window as any).CollectJS;
		if (!CollectJS) {
			errorMsg = 'Payment not ready. Please refresh.';
			return;
		}
		CollectJS.startPaymentRequest(e);
	}

	function tryAgain() {
		errorMsg = '';
		if (configuredOnce) {
			status = 'ready';
		} else {
			status = 'loading';
			void initialize();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget && status !== 'processing') onClose();
	}

	async function initialize() {
		if (!PUBLIC_KEY) {
			errorMsg = 'Payment configuration missing.';
			status = 'error';
			return;
		}
		try {
			await loadCollectScript();
			await tick();
			await new Promise((r) => setTimeout(r, 30));
			// biome-ignore lint/suspicious/noExplicitAny: NMI global
			if (!(window as any).CollectJS) {
				throw new Error('CollectJS not available after load');
			}
			configureCollect();
		} catch (e) {
			console.error('[NMI] init error', e);
			errorMsg = 'Could not load secure payment. Please refresh the page.';
			status = 'error';
		}
	}

	let lastOpen = $state(false);
	$effect(() => {
		if (open && !lastOpen) {
			lastOpen = true;
			status = 'loading';
			errorMsg = '';
			configuredOnce = false;
			void initialize();
		} else if (!open && lastOpen) {
			lastOpen = false;
		}
	});
</script>

{#if open}
	<div
		class="nmi-overlay"
		onclick={handleOverlayClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="nmi-title"
	>
		<div class="nmi-modal" role="document">
			<button
				class="nmi-close"
				onclick={onClose}
				disabled={status === 'processing'}
				aria-label="Close"
				type="button">×</button
			>

			<h2 id="nmi-title" class="nmi-title">Support Ellie</h2>
			<div class="nmi-amount">
				<span class="nmi-currency">{currencySymbol}</span>{amount}
			</div>
			<div class="nmi-sub">Secure one-time donation</div>

			{#if status === 'success'}
				<div class="nmi-success-box">
					<div class="nmi-check">✓</div>
					<div class="nmi-success-title">Thank you!</div>
					<div class="nmi-success-text">
						Your donation was received. Ellie's family thanks you.
					</div>
				</div>
			{:else}
				{#if errorMsg}
					<div class="nmi-error-box">
						<span>{errorMsg}</span>
						<button type="button" onclick={tryAgain} class="nmi-retry">Try again</button>
					</div>
				{/if}

				<div class="nmi-wallets">
					<div id="nmi-apple-pay" class="nmi-wallet-btn"></div>
					<div id="nmi-google-pay" class="nmi-wallet-btn"></div>
				</div>

				<div class="nmi-divider"><span>or pay with card</span></div>

				<form onsubmit={submitCard}>
					<div class="nmi-row">
						<input
							class="nmi-input"
							bind:value={firstName}
							placeholder="First name"
							autocomplete="given-name"
							required
							disabled={status === 'processing'}
						/>
						<input
							class="nmi-input"
							bind:value={lastName}
							placeholder="Last name"
							autocomplete="family-name"
							required
							disabled={status === 'processing'}
						/>
					</div>
					<input
						class="nmi-input"
						bind:value={email}
						type="email"
						placeholder="Email"
						autocomplete="email"
						required
						disabled={status === 'processing'}
					/>
					<div id="nmi-ccnumber" class="nmi-field"></div>
					<div class="nmi-row">
						<div id="nmi-ccexp" class="nmi-field"></div>
						<div id="nmi-cvv" class="nmi-field"></div>
					</div>
					<input
						class="nmi-input"
						bind:value={postalCode}
						placeholder="ZIP code"
						autocomplete="postal-code"
						maxlength="10"
						required
						disabled={status === 'processing'}
					/>

					<button
						type="submit"
						class="nmi-submit"
						disabled={status === 'processing' || status === 'loading'}
					>
						{#if status === 'processing'}
							<span class="nmi-spinner"></span> Processing…
						{:else if status === 'loading'}
							<span class="nmi-spinner"></span> Loading…
						{:else}
							🔒 Donate {currencySymbol}{amount} securely
						{/if}
					</button>
				</form>

				<div class="nmi-trust">
					<span>🔒 SSL encrypted</span>
					<span class="nmi-dot">·</span>
					<span>Powered by NMI</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.nmi-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.62);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		padding: 1rem;
		animation: nmi-fadein 0.18s ease-out;
	}
	@keyframes nmi-fadein {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.nmi-modal {
		background: #fff;
		border-radius: 20px;
		max-width: 460px;
		width: 100%;
		padding: 2rem 1.75rem 1.5rem;
		box-shadow: 0 24px 64px rgba(2, 32, 12, 0.28);
		position: relative;
		max-height: 92vh;
		overflow-y: auto;
		animation: nmi-slidein 0.22s ease-out;
	}
	@keyframes nmi-slidein {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.nmi-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: #f3f4f6;
		font-size: 1.5rem;
		line-height: 1;
		color: #4b5563;
		cursor: pointer;
		transition: background 0.15s;
	}
	.nmi-close:hover:not(:disabled) {
		background: #e5e7eb;
	}
	.nmi-close:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.nmi-title {
		font-size: 1.375rem;
		font-weight: 800;
		text-align: center;
		color: #111;
		margin: 0 0 0.25rem;
		letter-spacing: -0.01em;
	}
	.nmi-amount {
		text-align: center;
		font-size: 2.5rem;
		font-weight: 900;
		color: var(--primary-darker, #006b38);
		line-height: 1;
		letter-spacing: -0.03em;
		margin-bottom: 0.25rem;
	}
	.nmi-currency {
		font-size: 1.5rem;
		font-weight: 700;
		vertical-align: super;
		margin-right: 2px;
	}
	.nmi-sub {
		text-align: center;
		font-size: 0.8125rem;
		color: #6b7280;
		font-weight: 600;
		margin-bottom: 1.25rem;
	}
	.nmi-wallets {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.nmi-wallet-btn {
		min-height: 0;
	}
	.nmi-wallet-btn:empty {
		display: none;
	}
	.nmi-divider {
		display: flex;
		align-items: center;
		text-align: center;
		color: #9ca3af;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		margin: 0.75rem 0;
	}
	.nmi-divider::before,
	.nmi-divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid #e5e7eb;
	}
	.nmi-divider span {
		padding: 0 0.75rem;
	}
	.nmi-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.nmi-input {
		width: 100%;
		height: 46px;
		padding: 0 0.875rem;
		border: 1.5px solid #d1d5db;
		border-radius: 10px;
		font-size: 15px;
		font-family: inherit;
		color: #111;
		background: #fff;
		transition: border-color 0.15s;
		box-sizing: border-box;
		margin-bottom: 0.5rem;
	}
	.nmi-input::placeholder {
		color: #9ca3af;
		opacity: 1;
	}
	.nmi-row .nmi-input {
		margin-bottom: 0;
	}
	.nmi-input:focus {
		outline: none;
		border-color: var(--primary, #02a95c);
	}
	.nmi-input:disabled {
		background: #f9fafb;
		color: #9ca3af;
	}
	.nmi-field {
		width: 100%;
		height: 46px;
		border: 1.5px solid #d1d5db;
		border-radius: 10px;
		background: #fff;
		margin-bottom: 0.5rem;
		overflow: hidden;
		display: block;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}
	.nmi-field:focus-within {
		border-color: var(--primary, #02a95c);
	}
	.nmi-field :global(iframe) {
		width: 100% !important;
		height: 100% !important;
		border: 0 !important;
		display: block !important;
		background: transparent !important;
	}
	.nmi-row .nmi-field {
		margin-bottom: 0;
	}
	.nmi-submit {
		width: 100%;
		height: 54px;
		margin-top: 0.75rem;
		background: var(--primary, #02a95c);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 800;
		cursor: pointer;
		font-family: inherit;
		letter-spacing: 0.01em;
		transition: background 0.15s, transform 0.05s;
		box-shadow: 0 4px 12px rgba(2, 169, 92, 0.28);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.nmi-submit:hover:not(:disabled) {
		background: var(--primary-dark, #008f4c);
	}
	.nmi-submit:active:not(:disabled) {
		transform: translateY(1px);
	}
	.nmi-submit:disabled {
		background: #9ca3af;
		box-shadow: none;
		cursor: wait;
	}
	.nmi-trust {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.4rem;
		margin-top: 1rem;
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 600;
	}
	.nmi-dot {
		color: #d1d5db;
	}
	.nmi-error-box {
		background: #fef2f2;
		border: 1.5px solid #fecaca;
		color: #991b1b;
		border-radius: 10px;
		padding: 0.75rem 0.875rem;
		font-size: 0.8125rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.nmi-retry {
		align-self: flex-start;
		background: #fff;
		border: 1.5px solid #991b1b;
		color: #991b1b;
		padding: 0.375rem 0.875rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
	}
	.nmi-retry:hover {
		background: #991b1b;
		color: #fff;
	}
	.nmi-spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: nmi-spin 0.7s linear infinite;
	}
	@keyframes nmi-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.nmi-success-box {
		text-align: center;
		padding: 1.5rem 1rem 1rem;
	}
	.nmi-check {
		width: 64px;
		height: 64px;
		margin: 0 auto 1rem;
		border-radius: 50%;
		background: var(--primary-soft, #e6f7ee);
		color: var(--primary-darker, #006b38);
		font-size: 2.25rem;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}
	.nmi-success-title {
		font-size: 1.375rem;
		font-weight: 800;
		color: #111;
		margin-bottom: 0.375rem;
	}
	.nmi-success-text {
		color: #4b5563;
		font-size: 0.9375rem;
		line-height: 1.4;
	}

	@media (max-width: 480px) {
		.nmi-modal {
			padding: 1.75rem 1.25rem 1.25rem;
			border-radius: 16px;
		}
		.nmi-amount {
			font-size: 2rem;
		}
		.nmi-title {
			font-size: 1.25rem;
		}
	}
</style>
