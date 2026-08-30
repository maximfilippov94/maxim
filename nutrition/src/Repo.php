<?php
namespace App;

use App\Services\NutritionCalculator;

/**
 * Переиспользуемые запросы, которые нужны нескольким контроллерам.
 */
class Repo
{
    /**
     * Состав блюда в формате, который понимает NutritionCalculator:
     * КБЖУ ингредиента на 100 г + граммовка в блюде.
     */
    public static function dishComposition(int $dishId): array
    {
        return Database::all(
            'SELECT di.ingredient_id, di.grams, di.sort_order,
                    i.name, i.category, i.kcal, i.protein, i.fat, i.carbs, i.fiber, i.cooked_ratio
             FROM dish_ingredients di
             JOIN ingredients i ON i.id = di.ingredient_id
             WHERE di.dish_id = ?
             ORDER BY di.sort_order, di.id',
            [$dishId]
        );
    }

    /** Пересчитать и сохранить кэш КБЖУ блюда после правки состава. */
    public static function recomputeDishCache(int $dishId): array
    {
        $rows = self::dishComposition($dishId);
        $cache = NutritionCalculator::dishCache($rows);

        Database::exec(
            'UPDATE dishes
             SET base_portion_g = ?, kcal_100 = ?, protein_100 = ?, fat_100 = ?, carbs_100 = ?
             WHERE id = ?',
            [
                $cache['base_portion_g'],
                $cache['kcal_100'],
                $cache['protein_100'],
                $cache['fat_100'],
                $cache['carbs_100'],
                $dishId,
            ]
        );
        return $cache;
    }

    public static function dish(int $dishId): ?array
    {
        return Database::one('SELECT * FROM dishes WHERE id = ?', [$dishId]);
    }

    public static function dishTags(int $dishId): array
    {
        $rows = Database::all('SELECT tag FROM dish_tags WHERE dish_id = ? ORDER BY tag', [$dishId]);
        return array_column($rows, 'tag');
    }

    /**
     * Проверяет, что клиент принадлежит специалисту. Бросает 404/403.
     */
    public static function clientOwnedBy(int $clientId, int $specialistId): array
    {
        $client = Database::one('SELECT * FROM clients WHERE id = ?', [$clientId]);
        if (!$client) {
            throw new HttpException('Клиент не найден', 404);
        }
        if ((int)$client['specialist_id'] !== $specialistId) {
            throw new HttpException('Нет доступа к клиенту', 403);
        }
        return $client;
    }

    /**
     * Меню с проверкой прав. $viewer = ['type','id'].
     * Специалист видит свои меню, клиент — только свои.
     */
    public static function menuFor(int $menuId, array $viewer): array
    {
        $menu = Database::one('SELECT * FROM menus WHERE id = ?', [$menuId]);
        if (!$menu) {
            throw new HttpException('Меню не найдено', 404);
        }
        if ($viewer['type'] === 'specialist' && (int)$menu['specialist_id'] !== $viewer['id']) {
            throw new HttpException('Нет доступа к меню', 403);
        }
        if ($viewer['type'] === 'client' && (int)$menu['client_id'] !== $viewer['id']) {
            throw new HttpException('Нет доступа к меню', 403);
        }
        return $menu;
    }
}
