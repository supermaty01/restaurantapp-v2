import {
  EXPLICIT_VISIBILITIES,
  NEW_ENTRY_VISIBILITY,
  VISIBILITIES,
  VISIBILITY_META,
  isExplicit,
  resolveVisibility,
} from './visibility';

/**
 * `default` defers; it does not copy.
 *
 * The bug this pins down: entries used to store a *snapshot* of the general
 * setting taken when they were created, so changing the setting later moved
 * nothing, and everything imported from v1 stayed on whatever it happened to
 * get. A whole diary was invisible to its owner's friends and no setting could
 * reach it.
 */
describe('visibility', () => {
  it('stores a new entry as deferring, not as a copy of the setting', () => {
    expect(NEW_ENTRY_VISIBILITY).toBe('default');
  });

  it('resolves default against the current setting, both ways', () => {
    const shared = { restaurant: 'friends', dish: 'friends', visit: 'friends' } as const;
    const closed = { restaurant: 'private', dish: 'private', visit: 'private' } as const;

    expect(resolveVisibility('default', shared, 'visit')).toBe('friends');
    // The same stored value, the other answer: that is the whole point.
    expect(resolveVisibility('default', closed, 'visit')).toBe('private');
  });

  it('lets an explicit choice override the setting', () => {
    const shared = { restaurant: 'friends', dish: 'friends', visit: 'friends' } as const;
    expect(resolveVisibility('private', shared, 'visit')).toBe('private');
    expect(resolveVisibility('public', shared, 'visit')).toBe('public');
  });

  it('reads each entity independently', () => {
    const mixed = { restaurant: 'public', dish: 'private', visit: 'friends' } as const;
    expect(resolveVisibility('default', mixed, 'restaurant')).toBe('public');
    expect(resolveVisibility('default', mixed, 'dish')).toBe('private');
    expect(resolveVisibility('default', mixed, 'visit')).toBe('friends');
  });

  it('keeps default out of the settings screen options', () => {
    // A default that deferred to itself would say nothing.
    expect(EXPLICIT_VISIBILITIES).not.toContain('default');
    expect(VISIBILITIES).toContain('default');
    expect(EXPLICIT_VISIBILITIES.every(isExplicit)).toBe(true);
    expect(isExplicit('default')).toBe(false);
  });

  it('has a label for every value, so none can leak as a raw word', () => {
    for (const value of VISIBILITIES) {
      const meta = VISIBILITY_META[value];
      expect(meta.label).not.toBe(value);
      expect(meta.label.length).toBeGreaterThan(3);
      expect(meta.description.length).toBeGreaterThan(10);
    }
  });
});
