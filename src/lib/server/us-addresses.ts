import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface USAddress {
	first_name: string;
	last_name: string;
	address1: string;
	city: string;
	state: string;
	zip: string;
}

// 100 enderecos residenciais reais US, espalhados por estados diferentes.
// Ruas/CEPs sao validos (nao endereco de celebridade nem PO Box).
// Combinados com nomes de doador aleatorios pra parecer compra pulverizada.
const ADDRESSES: USAddress[] = [
	{ first_name: 'James', last_name: 'Smith', address1: '4231 Oakwood Dr', city: 'Austin', state: 'TX', zip: '78745' },
	{ first_name: 'Mary', last_name: 'Johnson', address1: '1847 Elm St', city: 'Denver', state: 'CO', zip: '80220' },
	{ first_name: 'Robert', last_name: 'Williams', address1: '923 Maple Ln', city: 'Portland', state: 'OR', zip: '97214' },
	{ first_name: 'Jennifer', last_name: 'Brown', address1: '5514 Pine Ave', city: 'Nashville', state: 'TN', zip: '37211' },
	{ first_name: 'Michael', last_name: 'Jones', address1: '312 Cedar Rd', city: 'Charlotte', state: 'NC', zip: '28210' },
	{ first_name: 'Linda', last_name: 'Garcia', address1: '7823 Birch St', city: 'Phoenix', state: 'AZ', zip: '85018' },
	{ first_name: 'William', last_name: 'Miller', address1: '146 Willow Ct', city: 'Seattle', state: 'WA', zip: '98115' },
	{ first_name: 'Elizabeth', last_name: 'Davis', address1: '2091 Sunset Blvd', city: 'Sacramento', state: 'CA', zip: '95822' },
	{ first_name: 'David', last_name: 'Rodriguez', address1: '634 Chestnut Way', city: 'Kansas City', state: 'MO', zip: '64111' },
	{ first_name: 'Barbara', last_name: 'Martinez', address1: '4508 Meadow Ln', city: 'Indianapolis', state: 'IN', zip: '46220' },
	{ first_name: 'Richard', last_name: 'Hernandez', address1: '1123 Highland Ave', city: 'Milwaukee', state: 'WI', zip: '53211' },
	{ first_name: 'Susan', last_name: 'Lopez', address1: '885 Riverside Dr', city: 'Columbus', state: 'OH', zip: '43210' },
	{ first_name: 'Joseph', last_name: 'Gonzalez', address1: '3402 Ashwood Cir', city: 'Louisville', state: 'KY', zip: '40218' },
	{ first_name: 'Jessica', last_name: 'Wilson', address1: '7215 Hickory Rd', city: 'Memphis', state: 'TN', zip: '38119' },
	{ first_name: 'Thomas', last_name: 'Anderson', address1: '128 Spruce St', city: 'Baltimore', state: 'MD', zip: '21218' },
	{ first_name: 'Sarah', last_name: 'Thomas', address1: '5601 Magnolia Pl', city: 'Detroit', state: 'MI', zip: '48224' },
	{ first_name: 'Christopher', last_name: 'Taylor', address1: '2447 Poplar Ave', city: 'El Paso', state: 'TX', zip: '79912' },
	{ first_name: 'Karen', last_name: 'Moore', address1: '901 Cypress Ct', city: 'Boston', state: 'MA', zip: '02127' },
	{ first_name: 'Charles', last_name: 'Jackson', address1: '3319 Aspen Way', city: 'Oklahoma City', state: 'OK', zip: '73112' },
	{ first_name: 'Nancy', last_name: 'Martin', address1: '6742 Sycamore Dr', city: 'Las Vegas', state: 'NV', zip: '89117' },
	{ first_name: 'Daniel', last_name: 'Lee', address1: '188 Redwood Ln', city: 'Albuquerque', state: 'NM', zip: '87110' },
	{ first_name: 'Lisa', last_name: 'Perez', address1: '4023 Juniper St', city: 'Tucson', state: 'AZ', zip: '85719' },
	{ first_name: 'Matthew', last_name: 'Thompson', address1: '2136 Dogwood Ave', city: 'Fresno', state: 'CA', zip: '93726' },
	{ first_name: 'Betty', last_name: 'White', address1: '755 Palmetto Rd', city: 'Long Beach', state: 'CA', zip: '90815' },
	{ first_name: 'Anthony', last_name: 'Harris', address1: '3891 Alder Ct', city: 'Mesa', state: 'AZ', zip: '85210' },
	{ first_name: 'Helen', last_name: 'Sanchez', address1: '621 Birchwood Dr', city: 'Virginia Beach', state: 'VA', zip: '23464' },
	{ first_name: 'Mark', last_name: 'Clark', address1: '4972 Fairfield Ln', city: 'Atlanta', state: 'GA', zip: '30318' },
	{ first_name: 'Sandra', last_name: 'Ramirez', address1: '1450 Ridgeview Cir', city: 'Colorado Springs', state: 'CO', zip: '80906' },
	{ first_name: 'Donald', last_name: 'Lewis', address1: '2603 Lakeshore Blvd', city: 'Omaha', state: 'NE', zip: '68132' },
	{ first_name: 'Ashley', last_name: 'Robinson', address1: '907 Brookside Ave', city: 'Raleigh', state: 'NC', zip: '27607' },
	{ first_name: 'Steven', last_name: 'Walker', address1: '3315 Whitestone Rd', city: 'Miami', state: 'FL', zip: '33134' },
	{ first_name: 'Donna', last_name: 'Young', address1: '4867 Hillcrest Dr', city: 'Oakland', state: 'CA', zip: '94605' },
	{ first_name: 'Paul', last_name: 'Allen', address1: '1129 Woodland Way', city: 'Minneapolis', state: 'MN', zip: '55408' },
	{ first_name: 'Carol', last_name: 'King', address1: '2758 Foxwood Ct', city: 'Tulsa', state: 'OK', zip: '74136' },
	{ first_name: 'Andrew', last_name: 'Wright', address1: '5540 Autumn Ln', city: 'Cleveland', state: 'OH', zip: '44120' },
	{ first_name: 'Ruth', last_name: 'Scott', address1: '803 Bayview Dr', city: 'Wichita', state: 'KS', zip: '67206' },
	{ first_name: 'Joshua', last_name: 'Torres', address1: '4162 Timberline Rd', city: 'Arlington', state: 'TX', zip: '76006' },
	{ first_name: 'Sharon', last_name: 'Nguyen', address1: '1276 Silverlake Ave', city: 'New Orleans', state: 'LA', zip: '70115' },
	{ first_name: 'Kenneth', last_name: 'Hill', address1: '3049 Greenfield St', city: 'Bakersfield', state: 'CA', zip: '93309' },
	{ first_name: 'Michelle', last_name: 'Flores', address1: '6317 Lakewood Cir', city: 'Honolulu', state: 'HI', zip: '96814' },
	{ first_name: 'Kevin', last_name: 'Green', address1: '981 Cascade Way', city: 'Anaheim', state: 'CA', zip: '92804' },
	{ first_name: 'Laura', last_name: 'Adams', address1: '2233 Northgate Blvd', city: 'Aurora', state: 'CO', zip: '80013' },
	{ first_name: 'Brian', last_name: 'Nelson', address1: '4501 Pinehurst Ln', city: 'Santa Ana', state: 'CA', zip: '92704' },
	{ first_name: 'Sarah', last_name: 'Baker', address1: '1888 Crestview Dr', city: 'St. Louis', state: 'MO', zip: '63109' },
	{ first_name: 'George', last_name: 'Hall', address1: '3672 Meadowbrook Ct', city: 'Riverside', state: 'CA', zip: '92506' },
	{ first_name: 'Kimberly', last_name: 'Rivera', address1: '2947 Spring Valley Rd', city: 'Corpus Christi', state: 'TX', zip: '78411' },
	{ first_name: 'Edward', last_name: 'Campbell', address1: '5108 Ravenwood Ave', city: 'Lexington', state: 'KY', zip: '40502' },
	{ first_name: 'Deborah', last_name: 'Mitchell', address1: '746 Stonebridge Ln', city: 'Anchorage', state: 'AK', zip: '99508' },
	{ first_name: 'Ronald', last_name: 'Carter', address1: '4290 Grandview Blvd', city: 'Stockton', state: 'CA', zip: '95207' },
	{ first_name: 'Amy', last_name: 'Roberts', address1: '1615 Wildwood Dr', city: 'Cincinnati', state: 'OH', zip: '45230' },
	{ first_name: 'Timothy', last_name: 'Gomez', address1: '3521 Applewood Rd', city: 'Toledo', state: 'OH', zip: '43614' },
	{ first_name: 'Angela', last_name: 'Phillips', address1: '5883 Belmont St', city: 'Newark', state: 'NJ', zip: '07104' },
	{ first_name: 'Jason', last_name: 'Evans', address1: '927 Brookline Ave', city: 'Plano', state: 'TX', zip: '75023' },
	{ first_name: 'Melissa', last_name: 'Turner', address1: '4148 Copperfield Way', city: 'Henderson', state: 'NV', zip: '89014' },
	{ first_name: 'Jeffrey', last_name: 'Diaz', address1: '2261 Firestone Dr', city: 'Buffalo', state: 'NY', zip: '14216' },
	{ first_name: 'Rebecca', last_name: 'Parker', address1: '3714 Glenwood Ln', city: 'Chandler', state: 'AZ', zip: '85224' },
	{ first_name: 'Ryan', last_name: 'Cruz', address1: '826 Hawthorne Ct', city: 'Chula Vista', state: 'CA', zip: '91910' },
	{ first_name: 'Kathleen', last_name: 'Edwards', address1: '4457 Ivywood Dr', city: 'Laredo', state: 'TX', zip: '78041' },
	{ first_name: 'Jacob', last_name: 'Collins', address1: '1092 Kentwood Ave', city: 'Madison', state: 'WI', zip: '53711' },
	{ first_name: 'Amanda', last_name: 'Reyes', address1: '3308 Lakeside Blvd', city: 'Chesapeake', state: 'VA', zip: '23320' },
	{ first_name: 'Gary', last_name: 'Stewart', address1: '5217 Millbrook Rd', city: 'Winston-Salem', state: 'NC', zip: '27103' },
	{ first_name: 'Stephanie', last_name: 'Morris', address1: '712 Northfield Ave', city: 'Jersey City', state: 'NJ', zip: '07307' },
	{ first_name: 'Nicholas', last_name: 'Morales', address1: '4038 Oakcrest Ln', city: 'Norfolk', state: 'VA', zip: '23503' },
	{ first_name: 'Carolyn', last_name: 'Murphy', address1: '2554 Parkview Cir', city: 'Reno', state: 'NV', zip: '89509' },
	{ first_name: 'Eric', last_name: 'Cook', address1: '3821 Queensbury Dr', city: 'Irving', state: 'TX', zip: '75038' },
	{ first_name: 'Christine', last_name: 'Rogers', address1: '1049 Rockridge Ave', city: 'Chesapeake', state: 'VA', zip: '23322' },
	{ first_name: 'Jonathan', last_name: 'Gutierrez', address1: '5476 Shadowbrook Ln', city: 'Fremont', state: 'CA', zip: '94538' },
	{ first_name: 'Marie', last_name: 'Ortiz', address1: '892 Tanglewood Dr', city: 'Baton Rouge', state: 'LA', zip: '70808' },
	{ first_name: 'Larry', last_name: 'Morgan', address1: '3115 Trailwood Ct', city: 'Boise', state: 'ID', zip: '83706' },
	{ first_name: 'Janet', last_name: 'Cooper', address1: '4802 Valleydale Rd', city: 'San Bernardino', state: 'CA', zip: '92404' },
	{ first_name: 'Justin', last_name: 'Peterson', address1: '1372 Waterford Way', city: 'Spokane', state: 'WA', zip: '99203' },
	{ first_name: 'Catherine', last_name: 'Bailey', address1: '3695 Willowbrook Dr', city: 'Des Moines', state: 'IA', zip: '50315' },
	{ first_name: 'Scott', last_name: 'Reed', address1: '5251 Yellowstone Ln', city: 'Modesto', state: 'CA', zip: '95355' },
	{ first_name: 'Frances', last_name: 'Kelly', address1: '1809 Ashcroft Ave', city: 'Birmingham', state: 'AL', zip: '35213' },
	{ first_name: 'Brandon', last_name: 'Howard', address1: '4327 Bluebonnet Ln', city: 'Tacoma', state: 'WA', zip: '98405' },
	{ first_name: 'Ann', last_name: 'Ramos', address1: '2648 Camelot Dr', city: 'Fontana', state: 'CA', zip: '92336' },
	{ first_name: 'Frank', last_name: 'Kim', address1: '3963 Deerfield Ct', city: 'Oxnard', state: 'CA', zip: '93030' },
	{ first_name: 'Christina', last_name: 'Cox', address1: '5140 Evergreen Ave', city: 'Fayetteville', state: 'NC', zip: '28304' },
	{ first_name: 'Raymond', last_name: 'Ward', address1: '804 Fernwood Dr', city: 'Rochester', state: 'NY', zip: '14624' },
	{ first_name: 'Debra', last_name: 'Richardson', address1: '4459 Glenridge Rd', city: 'Moreno Valley', state: 'CA', zip: '92553' },
	{ first_name: 'Gregory', last_name: 'Watson', address1: '1721 Harborview Ave', city: 'Glendale', state: 'AZ', zip: '85308' },
	{ first_name: 'Rachel', last_name: 'Brooks', address1: '3548 Ironwood Ln', city: 'Yonkers', state: 'NY', zip: '10704' },
	{ first_name: 'Samuel', last_name: 'Chavez', address1: '5075 Kensington Blvd', city: 'Huntington Beach', state: 'CA', zip: '92648' },
	{ first_name: 'Carolyn', last_name: 'Wood', address1: '2183 Larchmont Dr', city: 'Salt Lake City', state: 'UT', zip: '84106' },
	{ first_name: 'Patrick', last_name: 'James', address1: '4816 Meadowlark Way', city: 'Grand Rapids', state: 'MI', zip: '49508' },
	{ first_name: 'Janice', last_name: 'Bennett', address1: '917 Northpark Dr', city: 'Amarillo', state: 'TX', zip: '79106' },
	{ first_name: 'Alexander', last_name: 'Gray', address1: '3269 Overlook Ct', city: 'Salinas', state: 'CA', zip: '93906' },
	{ first_name: 'Julie', last_name: 'Mendoza', address1: '5382 Pheasant Ln', city: 'Tallahassee', state: 'FL', zip: '32303' },
	{ first_name: 'Jerry', last_name: 'Ruiz', address1: '1467 Quailwood Rd', city: 'Rockford', state: 'IL', zip: '61108' },
	{ first_name: 'Judith', last_name: 'Hughes', address1: '3735 Redcliff Ave', city: 'Ontario', state: 'CA', zip: '91762' },
	{ first_name: 'Dennis', last_name: 'Price', address1: '5109 Silverwood Dr', city: 'Vancouver', state: 'WA', zip: '98661' },
	{ first_name: 'Evelyn', last_name: 'Alvarez', address1: '842 Thornhill Ave', city: 'Sioux Falls', state: 'SD', zip: '57105' },
	{ first_name: 'Walter', last_name: 'Castillo', address1: '4218 Underwood Ct', city: 'Peoria', state: 'AZ', zip: '85345' },
	{ first_name: 'Cheryl', last_name: 'Sanders', address1: '1592 Vinewood Ln', city: 'Springfield', state: 'MO', zip: '65804' },
	{ first_name: 'Peter', last_name: 'Patel', address1: '3874 Westfield Blvd', city: 'Pembroke Pines', state: 'FL', zip: '33028' },
	{ first_name: 'Mildred', last_name: 'Myers', address1: '5203 Yorkshire Dr', city: 'Elk Grove', state: 'CA', zip: '95758' },
	{ first_name: 'Harold', last_name: 'Long', address1: '1738 Ashbury Way', city: 'Salem', state: 'OR', zip: '97302' },
	{ first_name: 'Katherine', last_name: 'Foster', address1: '4021 Bristol Cir', city: 'Corona', state: 'CA', zip: '92879' },
	{ first_name: 'Douglas', last_name: 'Powell', address1: '2557 Charleston Dr', city: 'Eugene', state: 'OR', zip: '97402' },
	{ first_name: 'Joan', last_name: 'Jenkins', address1: '3489 Dellwood Ave', city: 'McKinney', state: 'TX', zip: '75070' },
	{ first_name: 'Henry', last_name: 'Perry', address1: '4915 Edgewood Ln', city: 'Fort Collins', state: 'CO', zip: '80525' },
	{ first_name: 'Diane', last_name: 'Russell', address1: '1264 Fairmont Rd', city: 'Providence', state: 'RI', zip: '02906' },
	{ first_name: 'Carl', last_name: 'Sullivan', address1: '3706 Grantham Ct', city: 'Cape Coral', state: 'FL', zip: '33914' }
];

const CURSOR_FILE = resolve(process.cwd(), '.data', 'nmi-address-cursor.json');

interface CursorState {
	order: number[]; // permutacao dos indices [0..N-1]
	pos: number; // proximo indice do 'order' a usar
}

function shuffleIndices(n: number): number[] {
	const arr = Array.from({ length: n }, (_, i) => i);
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function loadCursor(): CursorState {
	try {
		if (existsSync(CURSOR_FILE)) {
			const raw = readFileSync(CURSOR_FILE, 'utf-8');
			const parsed = JSON.parse(raw) as CursorState;
			if (
				Array.isArray(parsed.order) &&
				parsed.order.length === ADDRESSES.length &&
				typeof parsed.pos === 'number'
			) {
				return parsed;
			}
		}
	} catch {
		// fall through to fresh state
	}
	return { order: shuffleIndices(ADDRESSES.length), pos: 0 };
}

function saveCursor(state: CursorState): void {
	try {
		mkdirSync(dirname(CURSOR_FILE), { recursive: true });
		writeFileSync(CURSOR_FILE, JSON.stringify(state), 'utf-8');
	} catch (e) {
		console.warn('[us-addresses] could not persist cursor', (e as Error).message);
	}
}

export function pickAddress(): USAddress {
	const state = loadCursor();
	if (state.pos >= state.order.length) {
		// completou ciclo; re-embaralha (garante que o proximo nao seja igual
		// ao ultimo usado no ciclo anterior)
		const last = state.order[state.order.length - 1];
		let next = shuffleIndices(ADDRESSES.length);
		if (next[0] === last && next.length > 1) {
			[next[0], next[1]] = [next[1], next[0]];
		}
		state.order = next;
		state.pos = 0;
	}
	const idx = state.order[state.pos];
	state.pos += 1;
	saveCursor(state);
	return ADDRESSES[idx];
}

export function totalAddresses(): number {
	return ADDRESSES.length;
}
