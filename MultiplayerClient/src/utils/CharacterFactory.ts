/**
 * CharacterFactory
 * Utility for creating character instances from character IDs
 */

import { CharacterIdsEnum, CharacterNamesEnum } from "../gameObjects/Characters/CharactersEnum.ts";
import { LizardWizard } from "../gameObjects/Characters/LizardWizard.ts";
import { SwordAndBoard } from "../gameObjects/Characters/SwordAndBoard.ts";
import { CheeseTouch } from "../gameObjects/Characters/CheeseTouch.ts";
import { BigSword } from "../gameObjects/Characters/BigSword.ts";
import { BoomStick } from "../gameObjects/Characters/BoomStick.ts";
import { Railgun } from "../gameObjects/Characters/Railgun.ts";
import { PlayerController } from "../gameObjects/Characters/PlayerController.ts";
import type { GameScene } from "../scenes/GameScene.ts";

/**
 * Map character ID string to CharacterNamesEnum
 */
export function getCharacterType(characterId: string): CharacterNamesEnum {
    switch (characterId) {
        case CharacterIdsEnum.BigSword:
            return CharacterNamesEnum.BigSword;
        case CharacterIdsEnum.SwordAndBoard:
            return CharacterNamesEnum.SwordAndBoard;
        case CharacterIdsEnum.CheeseTouch:
            return CharacterNamesEnum.CheeseTouch;
        case CharacterIdsEnum.BoomStick:
            return CharacterNamesEnum.BoomStick;
        case CharacterIdsEnum.Railgun:
            return CharacterNamesEnum.Railgun;
        case CharacterIdsEnum.LizardWizard:
        default:
            return CharacterNamesEnum.LizardWizard;
    }
}

/**
 * Create a character instance based on character type
 */
export function createCharacter(
    scene: GameScene,
    characterType: CharacterNamesEnum,
    x: number,
    y: number
): PlayerController {
    switch (characterType) {
        case CharacterNamesEnum.BigSword:
            return new BigSword(scene, x, y);
        case CharacterNamesEnum.SwordAndBoard:
            return new SwordAndBoard(scene, x, y);
        case CharacterNamesEnum.CheeseTouch:
            return new CheeseTouch(scene, x, y);
        case CharacterNamesEnum.BoomStick:
            return new BoomStick(scene, x, y);
        case CharacterNamesEnum.Railgun:
            return new Railgun(scene, x, y);
        case CharacterNamesEnum.LizardWizard:
        default:
            return new LizardWizard(scene, x, y);
    }
}

/**
 * Map character ID strings to CharacterNamesEnum for multiplayer
 */
export const CHARACTER_ID_MAP: {[key: string]: CharacterNamesEnum} = {
    'lizard-wizard': CharacterNamesEnum.LizardWizard,
    'sword-and-board': CharacterNamesEnum.SwordAndBoard,
    'cheese-touch': CharacterNamesEnum.CheeseTouch,
    'big-sword': CharacterNamesEnum.BigSword,
    'boom-stick': CharacterNamesEnum.BoomStick,
    'rail-gun': CharacterNamesEnum.Railgun,
};
