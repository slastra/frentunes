import { subscribe, getCurrent } from '$lib/server/icecast';

export function GET() {
	const encoder = new TextEncoder();
	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	function teardown() {
		unsubscribe?.();
		unsubscribe = null;
		if (heartbeat) {
			clearInterval(heartbeat);
			heartbeat = null;
		}
	}

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoder.encode(`data: ${JSON.stringify(getCurrent())}\n\n`));

			unsubscribe = subscribe((data) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				} catch {
					teardown();
				}
			});

			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`:heartbeat\n\n`));
				} catch {
					teardown();
				}
			}, 15000);
		},
		cancel() {
			teardown();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
}
