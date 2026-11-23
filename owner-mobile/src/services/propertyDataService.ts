// ============================================================================
// StayNest Shared Property & Bed Data Service
// Modular, reusable definitions for properties, floors, rooms, and beds
// ============================================================================

export interface BedItem {
  id: string;
  bedLabel: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  photo?: string;
}

export interface RoomItem {
  id: string;
  roomNumber: string;
  floorNumber: number;
  sharingType: string;
  rentRupees: number;
  depositRupees: number;
  beds: BedItem[];
}

export interface FloorItem {
  floorNumber: number;
  rooms: RoomItem[];
}

export const BED_STYLES = [
  { bg: '#fef3c7', border: '#fde68a', numColor: '#d97706', textColor: '#92400e' },
  { bg: '#dcfce7', border: '#bbf7d0', numColor: '#16a34a', textColor: '#166534' },
  { bg: '#fce7f3', border: '#fbcfe8', numColor: '#db2777', textColor: '#9d174d' },
  { bg: '#e0f2fe', border: '#bae6fd', numColor: '#0284c7', textColor: '#075985' },
  { bg: '#ede9fe', border: '#ddd6fe', numColor: '#7c3aed', textColor: '#5b21b6' },
  { bg: '#ffedd5', border: '#fed7aa', numColor: '#ea580c', textColor: '#9a3412' },
];

/**
 * Check if a string is a valid UUIDv4
 */
export const isValidUuid = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

/**
 * Returns deterministic floor, room, and bed structures for a property.
 * Supports both multi-PG setups:
 * - prop-pg-1: StayNest Elite Men's PG (18 beds total across 3 floors)
 * - prop-pg-2: Sai Durga Executive Ladies PG (12 beds total across 2 floors)
 */
export const getInitialFloorsForProperty = (propId: string): FloorItem[] => {
  if (propId === 'prop-pg-2') {
    return [
      {
        floorNumber: 1,
        rooms: [
          {
            id: 'rm-prop-pg-2-101',
            roomNumber: '101',
            floorNumber: 1,
            sharingType: 'TRIPLE',
            rentRupees: 9500,
            depositRupees: 9500,
            beds: [
              { id: 'b-prop-pg-2-101-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-101-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-101-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            ],
          },
          {
            id: 'rm-prop-pg-2-102',
            roomNumber: '102',
            floorNumber: 1,
            sharingType: 'TRIPLE',
            rentRupees: 9500,
            depositRupees: 9500,
            beds: [
              { id: 'b-prop-pg-2-102-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-102-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-102-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            ],
          },
        ],
      },
      {
        floorNumber: 2,
        rooms: [
          {
            id: 'rm-prop-pg-2-201',
            roomNumber: '201',
            floorNumber: 2,
            sharingType: 'TRIPLE',
            rentRupees: 9500,
            depositRupees: 9500,
            beds: [
              { id: 'b-prop-pg-2-201-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-201-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-201-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            ],
          },
          {
            id: 'rm-prop-pg-2-202',
            roomNumber: '202',
            floorNumber: 2,
            sharingType: 'TRIPLE',
            rentRupees: 9500,
            depositRupees: 9500,
            beds: [
              { id: 'b-prop-pg-2-202-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-202-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-2-202-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            ],
          },
        ],
      },
    ];
  }

  // Default: prop-pg-1 (StayNest Elite Men's PG)
  return [
    {
      floorNumber: 1,
      rooms: [
        {
          id: 'rm-prop-pg-1-101',
          roomNumber: '101',
          floorNumber: 1,
          sharingType: 'SIX',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-prop-pg-1-101-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-101-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-101-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-101-4', bedLabel: 'Bed 4', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-101-5', bedLabel: 'Bed 5', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-101-6', bedLabel: 'Bed 6', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'rm-prop-pg-1-102',
          roomNumber: '102',
          floorNumber: 1,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-prop-pg-1-102-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-102-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'rm-prop-pg-1-103',
          roomNumber: '103',
          floorNumber: 1,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-prop-pg-1-103-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-103-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
      ],
    },
    {
      floorNumber: 2,
      rooms: [
        {
          id: 'rm-prop-pg-1-201',
          roomNumber: '201',
          floorNumber: 2,
          sharingType: 'TRIPLE',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-prop-pg-1-201-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-201-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-201-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'rm-prop-pg-1-202',
          roomNumber: '202',
          floorNumber: 2,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-prop-pg-1-202-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-202-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
      ],
    },
    {
      floorNumber: 3,
      rooms: [
        {
          id: 'rm-prop-pg-1-301',
          roomNumber: '301',
          floorNumber: 3,
          sharingType: 'TRIPLE',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-prop-pg-1-301-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-301-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            { id: 'b-prop-pg-1-301-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
          ],
        },
      ],
    },
  ];
};
